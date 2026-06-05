import { useEffect, useRef, useState } from "react";
import { ExternalLink, LogOut, PlugZap, RefreshCcw, Wallet, Wifi } from "lucide-react";
import { useConnect, useConnection, useDisconnect, useReconnect, useSwitchChain } from "wagmi";
import {
  arcNetwork,
  formatArcChain,
  getArcEnvReport,
  getArcPaymentMode,
  getFriendlyWalletError,
  isWrongArcNetwork,
  requestAddArcTestnet,
  requestSwitchArcTestnet
} from "../../lib/arc";
import { shortAddress } from "../../lib/format";
import { getWalletRuntime, getWalletRuntimeLabel, openMetaMaskDeepLink } from "../../lib/mobileWallet";
import { useSettingsStore } from "../../state/useSettingsStore";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NetworkBadge } from "./NetworkBadge";

type WalletConnectPanelProps = {
  compact?: boolean;
  title?: string;
  onConnected?: () => void;
};

export function WalletConnectPanel({ compact = false, title = "Wallet login", onConnected }: WalletConnectPanelProps = {}) {
  const connection = useConnection();
  const { connectAsync, connectors, error: connectError, isPending: connecting } = useConnect();
  const { disconnectAsync, error: disconnectError, isPending: disconnecting } = useDisconnect();
  const { reconnectAsync, isPending: reconnecting } = useReconnect();
  const { switchChainAsync, error: switchError, isPending: switching } = useSwitchChain();
  const { disconnectConnectedWallet, upsertConnectedWallet } = useSettingsStore();
  const [localError, setLocalError] = useState<string>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [awaitingWalletReturn, setAwaitingWalletReturn] = useState(false);
  const [returnStatus, setReturnStatus] = useState<string>();
  const persistedConnection = useRef("");
  const lastConnectedAddress = useRef<string>();
  const latestConnection = useRef({ address: connection.address, isConnected: connection.isConnected });
  const recoveryStartedAt = useRef<number>();
  const walletRuntime = getWalletRuntime();

  const paymentMode = getArcPaymentMode();
  const wrongNetwork = isWrongArcNetwork(connection.chainId);
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const walletError = localError ?? getFirstFriendlyError(connectError, disconnectError, switchError);
  const connectedAddress = connection.address ? shortAddress(connection.address) : "Not connected";
  const connectableWallets = connectors.filter((connector) => connector.type !== "injected" || typeof window !== "undefined");
  const connectBusy = connecting || reconnecting;

  useEffect(() => {
    latestConnection.current = {
      address: connection.address,
      isConnected: connection.isConnected
    };
  }, [connection.address, connection.isConnected]);

  useEffect(() => {
    if (!connection.isConnected || !connection.address) {
      if (connection.isDisconnected && lastConnectedAddress.current) {
        disconnectConnectedWallet(lastConnectedAddress.current);
        lastConnectedAddress.current = undefined;
      }

      persistedConnection.current = "";
      return;
    }

    const connectionKey = [connection.address, connection.chainId, connection.connector?.id].join(":");

    if (persistedConnection.current === connectionKey) {
      return;
    }

    persistedConnection.current = connectionKey;
    lastConnectedAddress.current = connection.address;
    setAwaitingWalletReturn(false);
    setReturnStatus(undefined);
    recoveryStartedAt.current = undefined;
    upsertConnectedWallet({
      address: connection.address,
      chainId: connection.chainId,
      connectorId: connection.connector?.id,
      connectorName: connection.connector?.name
    });
    onConnected?.();
  }, [
    connection.address,
    connection.chainId,
    connection.connector?.id,
    connection.connector?.name,
    connection.isConnected,
    connection.isDisconnected,
    disconnectConnectedWallet,
    onConnected,
    upsertConnectedWallet
  ]);

  useEffect(() => {
    if (!awaitingWalletReturn) {
      return;
    }

    let cancelled = false;
    let retryTimer: number | undefined;

    async function recoverWalletSession() {
      if (cancelled) {
        return;
      }

      if (latestConnection.current.isConnected && latestConnection.current.address) {
        setAwaitingWalletReturn(false);
        setReturnStatus(undefined);
        recoveryStartedAt.current = undefined;
        return;
      }

      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setReturnStatus("Waiting for wallet approval...");
        return;
      }

      recoveryStartedAt.current ??= Date.now();
      setReturnStatus("Returning to ArcNest...");

      try {
        await reconnectAsync();
      } catch {
        // Mobile wallets can briefly reject reconnect while the browser is restoring focus.
      }

      if (latestConnection.current.isConnected && latestConnection.current.address) {
        setAwaitingWalletReturn(false);
        setReturnStatus(undefined);
        recoveryStartedAt.current = undefined;
        return;
      }

      if (Date.now() - recoveryStartedAt.current < 10_000) {
        retryTimer = window.setTimeout(() => void recoverWalletSession(), 750);
        return;
      }

      setAwaitingWalletReturn(false);
      setReturnStatus(undefined);
      recoveryStartedAt.current = undefined;
      setLocalError("Wallet connection was not completed. Choose a wallet and try again.");
    }

    function handleAppReturn() {
      void recoverWalletSession();
    }

    window.addEventListener("focus", handleAppReturn);
    window.addEventListener("pageshow", handleAppReturn);
    document.addEventListener("visibilitychange", handleAppReturn);
    retryTimer = window.setTimeout(() => void recoverWalletSession(), 750);

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      window.removeEventListener("focus", handleAppReturn);
      window.removeEventListener("pageshow", handleAppReturn);
      document.removeEventListener("visibilitychange", handleAppReturn);
    };
  }, [awaitingWalletReturn, reconnectAsync]);

  async function connectWallet(connector = connectableWallets[0]) {
    setLocalError(undefined);

    if (!connector) {
      setLocalError("No wallet connector is available. Install a browser wallet or add WalletConnect config.");
      return;
    }

    try {
      setAwaitingWalletReturn(true);
      setReturnStatus("Waiting for wallet approval...");
      recoveryStartedAt.current = undefined;
      await connectAsync({
        connector,
        ...(arcNetwork.chainId ? { chainId: arcNetwork.chainId } : {})
      });
      setReturnStatus("Returning to ArcNest...");
    } catch (error) {
      setAwaitingWalletReturn(false);
      setReturnStatus(undefined);
      recoveryStartedAt.current = undefined;
      setLocalError(getFriendlyWalletError(error));
    }
  }

  async function disconnectWallet() {
    if (!connection.address) {
      return;
    }

    const address = connection.address;
    setLocalError(undefined);

    try {
      await disconnectAsync();
      disconnectConnectedWallet(address);
    } catch (error) {
      setLocalError(getFriendlyWalletError(error));
    }
  }

  async function switchToArc() {
    setLocalError(undefined);

    try {
      if (connection.isConnected) {
        await switchChainAsync({ chainId: arcNetwork.chainId });
        return;
      }

      await requestSwitchArcTestnet();
    } catch (error) {
      try {
        await requestSwitchArcTestnet();
      } catch (fallbackError) {
        setLocalError(getFriendlyWalletError(fallbackError || error));
      }
    }
  }

  async function addArcTestnet() {
    setLocalError(undefined);

    try {
      await requestAddArcTestnet();
    } catch (error) {
      setLocalError(getFriendlyWalletError(error));
    }
  }

  if (compact) {
    return (
      <Card className="text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-muted)]">{title}</p>
            <p className="number mt-2 truncate text-lg font-bold">{connectedAddress}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {connection.isConnected ? connection.connector?.name ?? "Connected wallet" : "Choose a wallet to continue"}
            </p>
          </div>
          <NetworkBadge
            status={wrongNetwork ? "wrong" : missingConfig ? "missing" : paymentMode === "testnet" ? "active" : "mock"}
            label={wrongNetwork ? "Wrong network" : missingConfig ? "Missing config" : paymentMode === "testnet" ? "Arc Testnet" : "Preview"}
          />
        </div>

        {walletError ? <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--danger)]">{walletError}</div> : null}
        {returnStatus ? <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">{returnStatus}</div> : null}

        {missingConfig ? (
          <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
            Arc Testnet payments are not ready on this deploy. Preview payments stay local.
          </div>
        ) : null}

        {walletRuntime.isMobile && !walletRuntime.isInMetaMask && !walletRuntime.isInRabby ? (
          <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
            For the smoothest mobile signing flow, open ArcNest in a wallet browser or use WalletConnect.
          </div>
        ) : null}

        {!connection.isConnected ? (
          <div className="mt-4 grid gap-3">
            {connectableWallets.slice(0, 2).map((connector) => (
              <Button key={connector.uid} fullWidth icon={<Wallet size={16} />} onClick={() => void connectWallet(connector)} disabled={connectBusy}>
                {connectBusy ? "Connecting" : connector.name}
              </Button>
            ))}
            {connectableWallets.length === 0 ? (
              <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
                No wallet connector is available in this browser.
              </div>
            ) : null}
          </div>
        ) : wrongNetwork ? (
          <Button fullWidth className="mt-4" variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => void switchToArc()} disabled={switching}>
            Switch to Arc Testnet
          </Button>
        ) : (
          <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
            Wallet is ready. ArcNest will open automatically.
          </div>
        )}

        <Button fullWidth className="mt-3" variant="muted" size="sm" onClick={() => setAdvancedOpen((open) => !open)}>
          {advancedOpen ? "Hide wallet options" : "Wallet options"}
        </Button>

        {advancedOpen ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            {walletRuntime.isMobile && !walletRuntime.isInMetaMask ? (
              <Button variant="secondary" icon={<ExternalLink size={16} />} onClick={() => openMetaMaskDeepLink()}>
                Open wallet app
              </Button>
            ) : null}
            {connection.isConnected ? (
              <Button variant="muted" icon={<LogOut size={16} />} onClick={() => void disconnectWallet()} disabled={disconnecting}>
                Disconnect
              </Button>
            ) : null}
            <Button variant="secondary" icon={<Wifi size={16} />} onClick={() => void switchToArc()} disabled={missingConfig || switching}>
              Switch Arc
            </Button>
            <Button variant="muted" icon={<PlugZap size={16} />} onClick={() => void addArcTestnet()} disabled={missingConfig}>
              Add Arc Testnet
            </Button>
            {!connection.isConnected
              ? connectableWallets.slice(2).map((connector) => (
                  <Button key={connector.uid} variant="muted" icon={<Wallet size={16} />} onClick={() => void connectWallet(connector)} disabled={connectBusy}>
                    {connectBusy ? "Connecting" : connector.name}
                  </Button>
                ))
              : null}
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-muted)]">Wallet connection</p>
          <p className="number mt-2 truncate text-lg font-bold">{connectedAddress}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {connection.connector?.name ?? (connection.isConnected ? "Connected wallet" : "Connect for signed payments")} - {getWalletRuntimeLabel(walletRuntime)}
          </p>
        </div>
        <NetworkBadge
          status={wrongNetwork ? "wrong" : missingConfig ? "missing" : paymentMode === "testnet" ? "active" : "mock"}
          label={wrongNetwork ? "Wrong network" : missingConfig ? "Missing config" : paymentMode === "testnet" ? (connection.isConnected ? formatArcChain() : "Connect wallet") : "Demo payment"}
        />
      </div>

      {walletError ? <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--danger)]">{walletError}</div> : null}
      {returnStatus ? <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">{returnStatus}</div> : null}

      {missingConfig ? (
        <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          Arc testnet is not configured yet. Demo payment mode is active and no onchain transaction will be sent.
        </div>
      ) : null}

      {paymentMode === "testnet" && !wrongNetwork ? (
        <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          {connection.isConnected ? "Testnet mode is ready. Confirming a payment will request a USDC transfer in your wallet." : "Arc testnet config is ready. Connect a test wallet before paying."}
        </div>
      ) : null}

      {walletRuntime.isMobile && !walletRuntime.isInMetaMask && !walletRuntime.isInRabby ? (
        <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          Open ArcNest inside a wallet app for the most reliable mobile signing flow.
        </div>
      ) : null}

      <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
        Testnet only. Use a new test wallet. ArcNest never asks for seed phrases or private keys.
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {walletRuntime.isMobile && !walletRuntime.isInMetaMask ? (
          <Button variant="secondary" icon={<ExternalLink size={16} />} onClick={() => openMetaMaskDeepLink()}>
            Open wallet app
          </Button>
        ) : null}
        {connection.isConnected ? (
          <Button variant="muted" icon={<LogOut size={16} />} onClick={() => void disconnectWallet()} disabled={disconnecting}>
            Disconnect
          </Button>
        ) : (
          connectableWallets.slice(0, 2).map((connector) => (
            <Button key={connector.uid} icon={<Wallet size={16} />} onClick={() => void connectWallet(connector)} disabled={connectBusy}>
              {connectBusy ? "Connecting" : connector.name}
            </Button>
          ))
        )}
        {wrongNetwork ? (
          <Button variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => void switchToArc()} disabled={switching}>
            Switch Network
          </Button>
        ) : (
          <Button variant="secondary" icon={<Wifi size={16} />} onClick={() => void switchToArc()} disabled={missingConfig || switching}>
            Switch Arc
          </Button>
        )}
        <Button variant="muted" icon={<PlugZap size={16} />} onClick={() => void addArcTestnet()} disabled={missingConfig}>
          Add Arc Testnet
        </Button>
      </div>

      {import.meta.env.DEV ? <ArcEnvDebug /> : null}
    </Card>
  );
}

function ArcEnvDebug() {
  return (
    <div className="surface-row mt-4 rounded-[18px] p-3">
      <p className="text-xs font-semibold text-[var(--text-muted)]">Dev env check</p>
      <div className="mt-2 space-y-1">
        {getArcEnvReport().map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
            <span className="number truncate text-[var(--text-secondary)]">{item.key}</span>
            <span className={item.present ? "text-[var(--success)]" : item.optional ? "text-[var(--text-muted)]" : "text-[var(--warning)]"}>
              {item.present ? "present" : item.optional ? "optional missing" : "missing"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getFirstFriendlyError(...errors: unknown[]) {
  const error = errors.find(Boolean);
  return error ? getFriendlyWalletError(error) : undefined;
}
