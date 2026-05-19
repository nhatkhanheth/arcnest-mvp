import { ArrowDownLeft, ArrowUpRight, Copy } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { SoundToggle } from "../components/ui/SoundToggle";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { NetworkBadge } from "../components/wallet/NetworkBadge";
import { WalletConnectPanel } from "../components/wallet/WalletConnectPanel";
import { soundSettings } from "../data/mockData";
import { convertUSDCToDisplayAmount, formatUSDC, formatVND, shortAddress } from "../lib/format";
import type { PaymentRequest, ThemeMode } from "../models";
import { useState } from "react";
import { useGroupStore } from "../state/useGroupStore";
import { useSettingsStore } from "../state/useSettingsStore";

type WalletPageProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenQR: (mode?: "scan" | "myqr" | "payload" | "invite") => void;
  onOpenPayment: (request: PaymentRequest) => void;
};

export function WalletPage({ theme, onToggleTheme, onOpenQR, onOpenPayment }: WalletPageProps) {
  const { wallet } = useGroupStore();
  const { activeWallet, displayCurrency, primaryWallet, showWalletAddress } = useSettingsStore();
  const [settings, setSettings] = useState(soundSettings);

  function toggleSound(id: string, enabled: boolean) {
    setSettings((current) => current.map((item) => (item.id === id ? { ...item, enabled } : item)));
  }

  function openSend() {
    onOpenPayment({
      id: "wallet_send_preview",
      toName: "Mai",
      toWalletAddress: "0x764E1e967B3e2159a103949D61d0C084e6236Dd2",
      fromWalletAddress: primaryWallet.address,
      amountUSDC: "15.00",
      amountVND: 375000,
      note: "Wallet send preview"
    });
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
          <Button aria-label="Copy address" variant="muted" size="icon" onClick={() => void navigator.clipboard?.writeText(activeWallet.address)}>
            <Copy size={18} />
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <NetworkBadge />
          <span className="text-sm text-[var(--text-muted)]">{activeWallet.label}</span>
        </div>
        <div className="mt-5">
          <p className="text-sm font-semibold text-[var(--text-muted)]">USDC balance</p>
          <p className="number mt-2 text-4xl font-bold">{formatUSDC(wallet.balanceUSDC)}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {displayCurrency === "USDC" ? formatVND(wallet.balanceVND) : convertUSDCToDisplayAmount(wallet.balanceUSDC, displayCurrency)}
          </p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="muted" icon={<ArrowUpRight size={18} />} onClick={openSend}>
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
        <p className="mt-1 text-sm text-[var(--text-muted)]">Sound events are still mocked for this MVP.</p>
        <div className="mt-4 space-y-3">
          {settings.map((item) => (
            <SoundToggle key={item.id} label={item.label} enabled={item.enabled} onChange={(enabled) => toggleSound(item.id, enabled)} />
          ))}
        </div>
      </Card>
    </main>
  );
}
