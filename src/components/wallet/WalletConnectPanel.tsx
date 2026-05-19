import { useEffect, useRef, useState } from "react";
import { LogOut, PlugZap, RefreshCcw, Wallet } from "lucide-react";
import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { arcNetwork, formatArcChain, getArcPaymentMode, getFriendlyWalletError, isWrongArcNetwork } from "../../lib/arc";
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
  const walletError = localError ?? getFirstFriendlyError(connectError, disconnectError, switchError);
  const connectedAddress = connection.address ? shortAddress(connection.address) : "Not connected";

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

  async function connectWallet() {
    setLocalError(undefined);
    const connector = connectors[0];

    if (!connector) {
      setLocalError("No browser wallet was found. Install or unlock MetaMask, Rabby, or another injected wallet.");
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
          status={wrongNetwork ? "wrong" : paymentMode === "real" ? "active" : "mock"}
          label={wrongNetwork ? "Wrong network" : paymentMode === "real" ? formatArcChain() : "Mock fallback"}
        />
      </div>

      {walletError ? <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--danger)]">{walletError}</div> : null}

      {paymentMode === "mock" ? (
        <div className="surface-row mt-4 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          Demo mode is on. Payments complete with a mock confirmation until Arc payment settings are added.
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3">
        {connection.isConnected ? (
          <Button variant="muted" icon={<LogOut size={16} />} onClick={() => void disconnectWallet()} disabled={disconnecting}>
            Disconnect
          </Button>
        ) : (
          <Button icon={<Wallet size={16} />} onClick={() => void connectWallet()} disabled={connecting}>
            {connecting ? "Connecting" : "Connect"}
          </Button>
        )}
        {wrongNetwork ? (
          <Button variant="secondary" icon={<RefreshCcw size={16} />} onClick={() => void switchToArc()} disabled={switching}>
            Switch
          </Button>
        ) : (
          <Button variant="secondary" icon={<PlugZap size={16} />} disabled>
            {paymentMode === "real" ? "Ready" : "Demo"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function getFirstFriendlyError(...errors: unknown[]) {
  const error = errors.find(Boolean);
  return error ? getFriendlyWalletError(error) : undefined;
}
