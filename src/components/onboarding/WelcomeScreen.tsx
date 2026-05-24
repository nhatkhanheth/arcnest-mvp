import { ExternalLink, LockKeyhole, QrCode, ReceiptText, ShieldAlert, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { dynamicEnabled } from "../../lib/dynamic";
import { getWalletRuntime, openMetaMaskDeepLink } from "../../lib/mobileWallet";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { DynamicEmbeddedWalletPanel } from "../wallet/DynamicEmbeddedWalletPanel";
import { WalletConnectPanel } from "../wallet/WalletConnectPanel";

type WelcomeScreenProps = {
  onContinueDemo: () => void;
  appLocked?: boolean;
  hasLocalPasscode?: boolean;
  hasPreviousWallet?: boolean;
  previousWalletAddress?: string;
  unlockError?: string;
  onUnlockApp?: (passcode: string) => void;
};

const features = [
  { label: "Create or join groups", icon: <Users size={18} /> },
  { label: "Split expenses", icon: <ReceiptText size={18} /> },
  { label: "Pay with testnet wallet", icon: <Wallet size={18} /> },
  { label: "QR Pay and invite", icon: <QrCode size={18} /> }
];

export function WelcomeScreen({
  onContinueDemo,
  appLocked,
  hasLocalPasscode,
  hasPreviousWallet,
  previousWalletAddress,
  unlockError,
  onUnlockApp
}: WelcomeScreenProps) {
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [showDynamic, setShowDynamic] = useState(false);
  const [passcode, setPasscode] = useState("");
  const walletRuntime = getWalletRuntime();

  return (
    <main className="screen-pad space-y-5">
      <header className="pt-5">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22px] border border-[var(--border-soft)] bg-[var(--arc-soft)]">
          <span className="font-display text-xl font-bold">A</span>
        </div>
        <p className="text-sm font-semibold text-[var(--text-muted)]">Sign in to</p>
        <h1 className="font-display text-[40px] font-bold leading-tight">ArcNest</h1>
        <p className="mt-2 text-lg text-[var(--text-secondary)]">Connect a test wallet to load your groups and payments.</p>
      </header>

      <Card>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--warning)]/10 text-[var(--warning)]">
            <ShieldAlert size={18} />
          </span>
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            <p className="font-semibold text-[var(--text-primary)]">Testnet only</p>
            <p>Use a new test wallet only. Never enter a seed phrase or private key. Do not use real funds.</p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {appLocked && hasLocalPasscode ? (
          <div className="space-y-3">
            <Input
              label="App passcode"
              type="password"
              inputMode="numeric"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="Enter local passcode"
            />
            {unlockError ? (
              <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
                {unlockError}
              </div>
            ) : null}
            <Button fullWidth size="lg" icon={<LockKeyhole size={18} />} onClick={() => onUnlockApp?.(passcode)}>
              Unlock App
            </Button>
          </div>
        ) : null}
        <Button fullWidth size="lg" icon={<Wallet size={18} />} onClick={() => setShowWalletConnect(true)}>
          Connect Wallet
        </Button>
        {hasPreviousWallet ? (
          <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
            Previous wallet: <span className="number">{previousWalletAddress ? `${previousWalletAddress.slice(0, 6)}...${previousWalletAddress.slice(-4)}` : "Saved wallet"}</span>
          </div>
        ) : null}
        {walletRuntime.isMobile && !walletRuntime.isInMetaMask ? (
          <Button fullWidth size="lg" variant="secondary" icon={<ExternalLink size={18} />} onClick={() => openMetaMaskDeepLink()}>
            Open in MetaMask
          </Button>
        ) : null}
        <Button fullWidth size="lg" variant="secondary" onClick={onContinueDemo}>
          Continue Demo Mode
        </Button>
        {dynamicEnabled ? (
          <Button fullWidth size="lg" variant="muted" icon={<Wallet size={18} />} onClick={() => setShowDynamic(true)}>
            Embedded wallet
          </Button>
        ) : null}
      </div>

      {showWalletConnect ? (
        <div className="space-y-3">
          <WalletConnectPanel />
        </div>
      ) : null}

      {showDynamic ? (
        <div className="space-y-3">
          <DynamicEmbeddedWalletPanel />
        </div>
      ) : null}

      <section className="grid gap-3">
        {!dynamicEnabled ? <ComingSoonCard title="Embedded wallet" detail="Hidden until VITE_DYNAMIC_ENVIRONMENT_ID is configured." /> : null}
      </section>

      <section className="grid grid-cols-2 gap-2">
        {features.map((feature) => (
          <div key={feature.label} className="surface-row min-h-[68px] rounded-[18px] p-3 opacity-80">
            <span className="mb-2 flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--arc-soft)]">{feature.icon}</span>
            <p className="text-xs font-semibold leading-snug">{feature.label}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

function ComingSoonCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="surface-row flex items-center gap-3 rounded-[18px] p-4 opacity-75">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--row-bg)]">
        <LockKeyhole size={16} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-[var(--text-muted)]">{detail}</span>
      </span>
    </div>
  );
}
