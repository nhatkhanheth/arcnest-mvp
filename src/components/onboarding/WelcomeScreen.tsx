import { ExternalLink, LockKeyhole, ShieldAlert, Wallet } from "lucide-react";
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
  const shortPreviousWallet = previousWalletAddress ? `${previousWalletAddress.slice(0, 6)}...${previousWalletAddress.slice(-4)}` : undefined;

  return (
    <main className="screen-pad flex min-h-dvh flex-col justify-center space-y-5 py-[calc(28px+env(safe-area-inset-top))]">
      <header className="text-left">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[20px] border border-[var(--border-soft)] bg-[var(--arc-soft)]">
          <span className="font-display text-xl font-bold">A</span>
        </div>
        <h1 className="font-display text-[40px] font-bold leading-tight">ArcNest</h1>
        <p className="mt-2 text-base text-[var(--text-secondary)]">Shared payments for everyday life.</p>
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
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onUnlockApp?.(passcode);
            }}
          >
            <Input
              label="Passcode"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value.replace(/\s/g, ""))}
              placeholder="Enter passcode"
              className="number text-center text-lg tracking-[0.18em]"
            />
            {unlockError ? (
              <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
                {unlockError}
              </div>
            ) : null}
            <Button fullWidth size="lg" type="submit" icon={<LockKeyhole size={18} />}>
              Enter ArcNest
            </Button>
          </form>
        ) : null}
        <Button fullWidth size="lg" icon={<Wallet size={18} />} onClick={() => setShowWalletConnect(true)}>
          {hasPreviousWallet && shortPreviousWallet ? `Continue with ${shortPreviousWallet}` : "Login with Wallet"}
        </Button>
        {hasPreviousWallet ? (
          <div className="px-1 text-center text-xs text-[var(--text-muted)]">
            {shortPreviousWallet ? `Reconnect wallet ${shortPreviousWallet} or choose another wallet.` : "Reconnect your saved wallet or choose another wallet."}
          </div>
        ) : null}
        {walletRuntime.isMobile && !walletRuntime.isInMetaMask ? (
          <Button fullWidth size="lg" variant="secondary" icon={<ExternalLink size={18} />} onClick={() => openMetaMaskDeepLink()}>
            Open in MetaMask
          </Button>
        ) : null}
        <Button fullWidth size="lg" variant="ghost" onClick={onContinueDemo}>
          Preview App
        </Button>
        <p className="text-center text-xs text-[var(--text-muted)]">Demo mode is local only.</p>
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
    </main>
  );
}
