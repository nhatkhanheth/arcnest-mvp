import { LockKeyhole, QrCode, ReceiptText, ShieldAlert, Users, Wallet } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { WalletConnectPanel } from "../wallet/WalletConnectPanel";

type WelcomeScreenProps = {
  onContinueDemo: () => void;
  onComplete: () => void;
};

const features = [
  { label: "Create or join groups", icon: <Users size={18} /> },
  { label: "Split expenses", icon: <ReceiptText size={18} /> },
  { label: "Pay with testnet wallet", icon: <Wallet size={18} /> },
  { label: "QR Pay and invite", icon: <QrCode size={18} /> }
];

export function WelcomeScreen({ onContinueDemo, onComplete }: WelcomeScreenProps) {
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  return (
    <main className="screen-pad space-y-5">
      <header className="pt-5">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[22px] border border-[var(--border-soft)] bg-[var(--arc-soft)]">
          <span className="font-display text-xl font-bold">A</span>
        </div>
        <p className="text-sm font-semibold text-[var(--text-muted)]">Welcome to</p>
        <h1 className="font-display text-[40px] font-bold leading-tight">ArcNest</h1>
        <p className="mt-2 text-lg text-[var(--text-secondary)]">Shared payments for everyday life.</p>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {features.map((feature) => (
          <div key={feature.label} className="surface-row min-h-[92px] rounded-[20px] p-4">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--arc-soft)]">{feature.icon}</span>
            <p className="text-sm font-semibold leading-snug">{feature.label}</p>
          </div>
        ))}
      </section>

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
        <Button fullWidth size="lg" onClick={onContinueDemo}>
          Continue in Demo Mode
        </Button>
        <Button fullWidth size="lg" variant="secondary" icon={<Wallet size={18} />} onClick={() => setShowWalletConnect(true)}>
          Connect Test Wallet
        </Button>
      </div>

      {showWalletConnect ? (
        <div className="space-y-3">
          <WalletConnectPanel />
          <Button fullWidth variant="muted" onClick={onComplete}>
            Continue to ArcNest
          </Button>
        </div>
      ) : null}

      <section className="grid gap-3">
        <ComingSoonCard title="Create embedded wallet" detail="Coming soon. Use MetaMask, Rabby, or WalletConnect for now." />
        <ComingSoonCard title="Import wallet" detail="Coming soon. ArcNest will not ask for seed phrases or private keys." />
        <ComingSoonCard title="App passcode" detail="Coming soon. No wallet secrets are stored in this MVP." />
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
