import { QrCode, Settings } from "lucide-react";
import { useConnection } from "wagmi";
import { arcNetwork, getArcPaymentMode, isWrongArcNetwork } from "../../lib/arc";
import { Button } from "../ui/Button";

type GlobalHeaderActionsProps = {
  syncLabel?: string;
  onOpenSettings: () => void;
  onOpenQR: () => void;
};

export function GlobalHeaderActions({ syncLabel, onOpenSettings, onOpenQR }: GlobalHeaderActionsProps) {
  const connection = useConnection();
  const paymentMode = getArcPaymentMode();
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const wrongNetwork = paymentMode === "testnet" && connection.isConnected && isWrongArcNetwork(connection.chainId);
  const modeLabel = wrongNetwork ? "Wrong Network" : missingConfig ? "Demo Mode" : connection.isConnected ? "Arc Testnet" : "Testnet Ready";

  return (
    <div className="global-header-actions pointer-events-auto px-5 pt-[max(16px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-1.5 text-[11px] font-semibold leading-none text-[var(--text-muted)]">
            {modeLabel}
          </span>
          {syncLabel ? (
            <span className="rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-1.5 text-[11px] font-semibold leading-none text-[var(--text-muted)]">
              {syncLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button aria-label="Open QR Pay" variant="muted" size="icon" className="h-10 w-10 rounded-[16px] bg-[var(--card-bg)]" onClick={onOpenQR}>
            <QrCode size={18} />
          </Button>
          <Button aria-label="Open settings" variant="muted" size="icon" className="h-10 w-10 rounded-[16px] bg-[var(--card-bg)]" onClick={onOpenSettings}>
            <Settings size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
