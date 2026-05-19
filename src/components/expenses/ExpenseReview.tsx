import { CheckCircle2 } from "lucide-react";
import type { ExpenseShare, SplitMode } from "../../models";
import { formatUSDC, formatVND } from "../../lib/format";
import { Button } from "../ui/Button";

type ExpenseReviewProps = {
  title: string;
  amountVND: number;
  amountUSDC: string;
  splitMode: SplitMode;
  shares: ExpenseShare[];
  warning?: string;
  onBack: () => void;
  onSave: () => void;
};

const labels: Record<SplitMode, string> = {
  equal: "Equal split",
  fixed: "Fixed split",
  custom: "Custom split",
  treasury: "Treasury payment"
};

export function ExpenseReview({
  title,
  amountVND,
  amountUSDC,
  splitMode,
  shares,
  warning,
  onBack,
  onSave
}: ExpenseReviewProps) {
  return (
    <div className="space-y-4">
      <div className="surface-row rounded-[18px] p-4">
        <p className="text-xs font-semibold text-[var(--text-muted)]">Review expense</p>
        <h3 className="mt-2 font-display text-xl font-bold">{title || "Untitled expense"}</h3>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="number text-2xl font-bold">{formatUSDC(amountUSDC)}</p>
            <p className="text-sm text-[var(--text-muted)]">{formatVND(amountVND)}</p>
          </div>
          <span className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold">
            {labels[splitMode]}
          </span>
        </div>
      </div>
      {warning ? (
        <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
          {warning}
        </div>
      ) : null}
      <div className="space-y-2">
        {shares.map((share) => (
          <div key={share.memberId} className="surface-row flex min-h-[58px] items-center justify-between gap-3 rounded-[18px] px-4">
            <div>
              <p className="font-semibold">{share.displayName}</p>
              <p className="text-xs capitalize text-[var(--text-muted)]">{share.direction}</p>
            </div>
            <div className="text-right">
              <p className="number font-bold">{formatUSDC(share.amountUSDC)}</p>
              <p className="text-xs text-[var(--text-muted)]">{formatVND(share.amountVND)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button icon={<CheckCircle2 size={18} />} onClick={onSave} disabled={Boolean(warning)}>
          Save expense
        </Button>
      </div>
    </div>
  );
}
