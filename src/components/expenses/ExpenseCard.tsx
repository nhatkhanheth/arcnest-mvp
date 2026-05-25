import { ReceiptText } from "lucide-react";
import type { Expense, GroupMember, Payment } from "../../models";
import { formatTime, formatUSDC, formatVND } from "../../lib/format";
import { getExpenseShareAmounts, getTreasuryMemberId, isTreasuryMemberId, toUSDC, USDC_VND_RATE } from "../../services/balanceService";

type ExpenseCardProps = {
  expense: Expense;
  members: GroupMember[];
  payments?: Payment[];
  currentMemberId?: string;
  highlighted?: boolean;
  onOpen?: () => void;
};

export function ExpenseCard({ expense, members, payments = [], currentMemberId, highlighted, onOpen }: ExpenseCardProps) {
  const payer = members.find((member) => member.id === expense.paidBy);
  const payerName = expense.splitMode === "treasury" ? "Group treasury" : payer?.displayName ?? "Member";
  const userAmount = getUserAmount(expense, currentMemberId, payments);

  return (
    <button
      type="button"
      className={[
        "surface-row focus-ring block w-full rounded-[18px] p-4 text-left transition active:scale-[0.99]",
        highlighted ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : ""
      ].join(" ")}
      onClick={onOpen}
    >
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
          <p className="number text-sm font-bold">{formatUSDC(expense.amountUSDC)}</p>
          <p className="text-xs text-[var(--text-muted)]">Total {formatVND(expense.amountVND)}</p>
          <p className={["mt-2 text-xs font-semibold", userAmount.tone === "success" ? "text-[var(--success)]" : userAmount.tone === "warning" ? "text-[var(--warning)]" : "text-[var(--text-muted)]"].join(" ")}>
            {userAmount.label}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">{formatTime(expense.createdAt)}</p>
    </button>
  );
}

function getUserAmount(expense: Expense, currentMemberId: string | undefined, payments: Payment[]) {
  if (!currentMemberId) {
    return { label: "Connect wallet", tone: "muted" as const };
  }

  const shares = getExpenseShareAmounts(expense);
  const receiverId = expense.splitMode === "treasury" ? getTreasuryMemberId(expense.groupId) : expense.paidBy;
  const userShareVND = Math.round(Number(shares[currentMemberId] ?? 0));

  if (currentMemberId === receiverId) {
    return { label: `You paid ${formatUSDC(expense.amountUSDC)}`, tone: "success" as const };
  }

  if (!expense.participants.includes(currentMemberId) || userShareVND <= 0) {
    return { label: "Not included", tone: "muted" as const };
  }

  const paidVND = payments
    .filter(
      (payment) =>
        payment.groupId === expense.groupId &&
        payment.expenseId === expense.id &&
        payment.status === "paid" &&
        payment.fromMemberId === currentMemberId &&
        payment.toMemberId === receiverId
    )
    .reduce((total, payment) => total + Math.round(Number(payment.amountVND ?? Number(payment.amountUSDC) * USDC_VND_RATE)), 0);
  const hasPendingPayment = payments.some(
    (payment) =>
      payment.groupId === expense.groupId &&
      payment.expenseId === expense.id &&
      payment.status === "pending" &&
      payment.fromMemberId === currentMemberId &&
      payment.toMemberId === receiverId
  );
  const hasFailedPayment = payments.some(
    (payment) =>
      payment.groupId === expense.groupId &&
      payment.expenseId === expense.id &&
      payment.status === "failed" &&
      payment.fromMemberId === currentMemberId &&
      payment.toMemberId === receiverId
  );

  if (paidVND >= userShareVND) {
    return { label: "Settled", tone: "success" as const };
  }

  if (hasPendingPayment) {
    return { label: "Payment pending", tone: "muted" as const };
  }

  if (hasFailedPayment) {
    return { label: "Payment failed", tone: "warning" as const };
  }

  const receiverLabel = isTreasuryMemberId(receiverId) ? "treasury" : "paid member";
  return { label: `You owe ${formatUSDC(toUSDC(userShareVND))} to ${receiverLabel}`, tone: "warning" as const };
}
