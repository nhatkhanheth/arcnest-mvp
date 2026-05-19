import { QrCode, Settings } from "lucide-react";
import { Button } from "../ui/Button";

type GlobalHeaderActionsProps = {
  syncLabel?: string;
  onOpenSettings: () => void;
  onOpenQR: () => void;
};

export function GlobalHeaderActions({ syncLabel, onOpenSettings, onOpenQR }: GlobalHeaderActionsProps) {
  return (
    <div className="pointer-events-auto absolute right-5 top-[max(16px,env(safe-area-inset-top))] z-20 flex items-center gap-2">
      {syncLabel ? (
        <span className="rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
          {syncLabel}
        </span>
      ) : null}
      <Button aria-label="Open QR Pay" variant="muted" size="icon" className="h-10 w-10 rounded-[16px] bg-[var(--card-bg)]" onClick={onOpenQR}>
        <QrCode size={18} />
      </Button>
      <Button aria-label="Open settings" variant="muted" size="icon" className="h-10 w-10 rounded-[16px] bg-[var(--card-bg)]" onClick={onOpenSettings}>
        <Settings size={18} />
      </Button>
    </div>
  );
}
