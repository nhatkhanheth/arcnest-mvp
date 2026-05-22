import { ArrowDownLeft, ArrowUpRight, Copy } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SoundToggle } from "../components/ui/SoundToggle";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { NetworkBadge } from "../components/wallet/NetworkBadge";
import { WalletConnectPanel } from "../components/wallet/WalletConnectPanel";
import { soundSettings } from "../data/mockData";
import { arcNetwork, formatArcChain, getArcPaymentMode, isWrongArcNetwork } from "../lib/arc";
import { convertUSDCToDisplayAmount, formatUSDC, formatVND, shortAddress } from "../lib/format";
import type { ThemeMode } from "../models";
import { useState } from "react";
import { useConnection } from "wagmi";
import { useGroupStore } from "../state/useGroupStore";
import { useSettingsStore } from "../state/useSettingsStore";

type WalletPageProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenQR: (mode?: "scan" | "myqr" | "payload" | "invite") => void;
  onOpenSend: () => void;
};

export function WalletPage({ theme, onToggleTheme, onOpenQR, onOpenSend }: WalletPageProps) {
  const { wallet } = useGroupStore();
  const { activeWallet, displayCurrency, showWalletAddress } = useSettingsStore();
  const connection = useConnection();
  const [settings, setSettings] = useState(soundSettings);
  const paymentMode = getArcPaymentMode();
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const wrongNetwork = paymentMode === "testnet" && connection.isConnected && isWrongArcNetwork(connection.chainId);
  const modeLabel = wrongNetwork ? "Wrong network" : missingConfig ? "Missing config" : connection.isConnected ? formatArcChain() : "Connect wallet";

  function toggleSound(id: string, enabled: boolean) {
    setSettings((current) => current.map((item) => (item.id === id ? { ...item, enabled } : item)));
  }

  return (
    <main className="screen-pad space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--text-muted)]">Wallet</p>
        <h1 className="font-display text-[28px] font-bold">Arc wallet</h1>
      </header>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--text-muted)]">Wallet address</p>
            <p className="number mt-2 truncate text-lg font-bold">{showWalletAddress ? shortAddress(activeWallet.address) : "Hidden"}</p>
          </div>
          <Button aria-label="Copy address" variant="muted" size="icon" onClick={() => void navigator.clipboard?.writeText(activeWallet.address)} disabled={!activeWallet.address}>
            <Copy size={18} />
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <NetworkBadge status={wrongNetwork ? "wrong" : missingConfig ? "missing" : paymentMode === "testnet" && connection.isConnected ? "active" : "mock"} label={modeLabel} />
          <span className="text-sm text-[var(--text-muted)]">{activeWallet.label}</span>
        </div>
        <div className="mt-5">
          <p className="text-sm font-semibold text-[var(--text-muted)]">USDC balance</p>
          <p className="number mt-2 text-4xl font-bold">{formatUSDC(wallet.balanceUSDC)}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {displayCurrency === "USDC" ? formatVND(wallet.balanceVND) : convertUSDCToDisplayAmount(wallet.balanceUSDC, displayCurrency)}
          </p>
        </div>
        <div className="surface-row mt-5 rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          Testnet only. Use a new test wallet, never enter a seed phrase or private key, and do not use real funds.
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="muted" icon={<ArrowUpRight size={18} />} onClick={onOpenSend} disabled={!activeWallet.address}>
            Send
          </Button>
          <Button variant="muted" icon={<ArrowDownLeft size={18} />} onClick={() => onOpenQR("myqr")}>
            Receive / My QR
          </Button>
        </div>
      </Card>

      <WalletConnectPanel />

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold">Appearance</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Arc Dark is the default theme.</p>
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Sound</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Sound preferences for app feedback.</p>
        <div className="mt-4 space-y-3">
          {settings.map((item) => (
            <SoundToggle key={item.id} label={item.label} enabled={item.enabled} onChange={(enabled) => toggleSound(item.id, enabled)} />
          ))}
        </div>
      </Card>
    </main>
  );
}
