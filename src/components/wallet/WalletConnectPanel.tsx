import { useEffect, useRef, useState } from "react";
import { LogOut, PlugZap, RefreshCcw, Wallet } from "lucide-react";
import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { arcNetwork, formatArcChain, getArcEnvReport, getArcPaymentMode, getFriendlyWalletError, isWrongArcNetwork } from "../../lib/arc";
import { shortAddress } from "../../lib/format";
import { useSettingsStore } from "../../state/useSettingsStore";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NetworkBadge } from "./NetworkBadge";

export function WalletConnectPanel() {
  const connection = useConnection();
  const { connectAsync, connectors, error: connectError, isPending: connecting } = useConnect();
  const { disconnectAsync, error: disconnectError, isPending: disconnecting } = useDisconnect();
  const { switchChainAsync, error: switchError, isPending: switching } = useSwitchChain();
  const { disconnectConnectedWallet, upsertConnectedWallet } = useSettingsStore();
  const [localError, setLocalError] = useState<string>();
  const persistedConnection = useRef("");
  const lastConnectedAddress = useRef<string>();

  const paymentMode = getArcPaymentMode();
  const wrongNetwork = isWrongArcNetwork(connection.chainId);
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const walletError = localError ?? getFirstFriendlyError(connectError, disconnectError, switchError);
  const connectedAddress = connection.address ? shortAddress(connection.address) : "Not connected";
  const connectableWallets = connectors.filter((connector) => connector.type !== "injected" || typeof window !== "undefined");

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
    upsertConnectedWallet({
      address: connection.address,
      chainId: connection.chainId,
      connectorId: connection.connector?.id,
      connectorName: connection.connector?.name
    });
  }, [
    connection.address,
    connection.chainId,
    connection.connector?.id,
    connection.connector?.name,
    connection.isConnected,
    connection.isDisconnected,
    disconnectConnectedWallet,
    upsertConnectedWallet
  ]);

  async function connectWallet(connector = connectableWallets[0]) {
    setLocalError(undefined);

    if (!connector) {
      setLocalError("No wallet connector is available. Install a browser wallet or add WalletConnect config.");
      return;
    }

    try {
      await connectAsync({
        connector,
        ...(arcNetwork.chainId ? { chainId: arcNetwork.chainId } : {})
      });
    } catch (error) {
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
    if (!arcNetwork.chainId) {
      setLocalError("Arc chain ID is not configured yet. Add VITE_ARC_CHAIN_ID to enable network switching.");
      return;
    }

    setLocalError(undefined);

    try {
      await switchChainAsync({ chainId: arcNetwork.chainId });
    } catch (error) {
      setLocalError(getFriendlyWalletError(error));
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-muted)]">Wallet connection</p>
          <p className="number mt-2 truncate text-lg font-bold">{connectedAddress}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {connection.connector?.name ?? (connection.isConnected ? "Connected wallet" : "Connect for signed payments")}
          </p>
        </div>
        <NetworkBadge
          status={wrongNetwork ? "wrong" : missingConfig ? "missing" : paymentMode === "testnet" ? "active" : "mock"}
          label={wrongNetwork ? "Wrong network" : missingConfig ? "Missing config" : paymentMode === "testnet" ? formatArcChain() : "Demo payment"}
        />
      </div>

      {walletError ? <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--danger)]">{walletError}</div> : null}

      {missingConfig ? (
        <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          Missing {arcNetwork.missingPaymentEnvVars.join(", ")}. Payments stay in demo mode until these are set in Vercel and the app is redeployed.
        </div>
      ) : null}

      {paymentMode === "testnet" && !wrongNetwork ? (
        <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          Testnet mode is ready. Confirming a payment will request a USDC transfer in your wallet.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {connection.isConnected ? (
          <Button variant="muted" icon={<LogOut size={16} />} onClick={() => void disconnectWallet()} disabled={disconnecting}>
            Disconnect
          </Button>
        ) : (
          connectableWallets.slice(0, 2).map((connector) => (
            <Button key={connector.uid} icon={<Wallet size={16} />} onClick={() => void connectWallet(connector)} disabled={connecting}>
              {connecting ? "Connecting" : connector.name}
            </Button>
          ))
        )}
        {wrongNetwork ? (
          <Button variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => void switchToArc()} disabled={switching}>
            Switch
          </Button>
        ) : (
          <Button variant="secondary" icon={<PlugZap size={16} />} disabled>
            {missingConfig ? "Missing config" : paymentMode === "testnet" ? "Testnet" : "Demo"}
          </Button>
        )}
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
