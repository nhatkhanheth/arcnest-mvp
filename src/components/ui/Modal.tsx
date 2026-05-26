import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

type BottomSheetProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  fullHeight?: boolean;
};

export function BottomSheet({ open, title, subtitle, children, onClose, footer, fullHeight }: BottomSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-0 backdrop-blur-sm">
      <div className="mobile-frame pointer-events-none flex min-h-dvh items-end">
        <section
          className={[
            "pointer-events-auto max-h-[calc(100dvh-env(safe-area-inset-top))] w-full rounded-t-[28px] border border-[var(--border-soft)] bg-[var(--bg-secondary)] shadow-soft",
            fullHeight ? "min-h-[92dvh]" : ""
          ].join(" ")}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-[var(--border-strong)]" />
          <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
            <div>
              {title ? <h2 className="font-display text-xl font-bold">{title}</h2> : null}
              {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
            </div>
            <Button aria-label="Close" variant="muted" size="icon" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
          <div className={[fullHeight ? "max-h-[calc(92dvh-92px)]" : "max-h-[72dvh]", "overflow-x-hidden overflow-y-auto px-5 pb-[calc(20px+env(safe-area-inset-bottom))]"].join(" ")}>{children}</div>
          {footer ? (
            <div className="border-t border-[var(--border-soft)] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-4">
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
