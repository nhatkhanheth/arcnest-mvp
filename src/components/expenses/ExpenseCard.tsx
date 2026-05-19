import { PenLine, ReceiptText } from "lucide-react";
import type { Expense, GroupMember } from "../../models";
import { formatTime, formatUSDC, formatVND } from "../../lib/format";
import { Button } from "../ui/Button";

type ExpenseCardProps = {
  expense: Expense;
  members: GroupMember[];
  canEdit?: boolean;
  onEdit?: () => void;
};

export function ExpenseCard({ expense, members, canEdit, onEdit }: ExpenseCardProps) {
  const payer = members.find((member) => member.id === expense.paidBy);
  const payerName = expense.splitMode === "treasury" ? "Group treasury" : payer?.displayName ?? "Member";

  return (
    <div className="surface-row rounded-[18px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--cream-soft)]">
            <ReceiptText size={18} />
          </span>
          <div className="min-w-0">
            <h4 className="truncate font-semibold">{expense.title}</h4>
            <p className="text-sm text-[var(--text-muted)]">
              Paid by {payerName} - {expense.category}
            </p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="number font-bold">{formatUSDC(expense.amountUSDC)}</p>
          <p className="text-xs text-[var(--text-muted)]">{formatVND(expense.amountVND)}</p>
          {canEdit ? (
            <Button className="mt-2" variant="muted" size="sm" icon={<PenLine size={14} />} onClick={onEdit}>
              Edit
            </Button>
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">{formatTime(expense.createdAt)}</p>
    </div>
  );
}
