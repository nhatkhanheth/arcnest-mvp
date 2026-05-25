import { Ban, ExternalLink, Pencil, ReceiptText, Trash2, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Expense, Group, GroupMember, Payment, PaymentRequest, Treasury } from "../../models";
import { getArcExplorerTxUrl } from "../../lib/arc";
import { formatDateLabel, formatTime, formatUSDC, formatVND, shortAddress } from "../../lib/format";
import { getExpenseShareAmounts, getTreasuryMemberId, isTreasuryMemberId, toUSDC, USDC_VND_RATE } from "../../services/balanceService";
import { getExpenseDate } from "../../services/expenseService";
import { Button } from "../ui/Button";
import { BottomSheet } from "../ui/Modal";

type ExpenseDetailSheetProps = {
  open: boolean;
  expense?: Expense;
  group?: Group;
  members: GroupMember[];
  payments: Payment[];
  treasuries: Treasury[];
  currentMember?: GroupMember;
  currentWalletAddress: string;
  canEdit?: boolean;
  canDelete?: boolean;
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onVoid: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
  onPayNow: (request: PaymentRequest) => string | undefined;
};

export function ExpenseDetailSheet({
  open,
  expense,
  group,
  members,
  payments,
  treasuries,
  currentMember,
  currentWalletAddress,
  canEdit,
  canDelete,
  onClose,
  onEdit,
  onVoid,
  onDelete,
  onPayNow
}: ExpenseDetailSheetProps) {
  const [actionError, setActionError] = useState<string>();

  const detail = useMemo(() => {
    if (!expense) {
      return undefined;
    }

    const shares = getExpenseShareAmounts(expense);
    const receiverMemberId = expense.splitMode === "treasury" ? getTreasuryMemberId(expense.groupId) : expense.paidBy;
    const receiver = members.find((member) => member.id === receiverMemberId);
    const treasury = treasuries.find((item) => item.groupId === expense.groupId);
    const currentShareVND = currentMember ? Math.round(Number(shares[currentMember.id] ?? 0)) : 0;
    const currentShareUSDC = toUSDC(currentShareVND);
    const involved = Boolean(currentMember && expense.participants.includes(currentMember.id));
    const receiverIsCurrentUser = currentMember?.id === receiverMemberId;
    const relatedPayments = currentMember
      ? payments.filter(
          (payment) =>
            payment.groupId === expense.groupId &&
            payment.fromMemberId === currentMember.id &&
            payment.toMemberId === receiverMemberId &&
            payment.expenseId === expense.id
        )
      : [];
    const paidAmountVND = relatedPayments
      .filter((payment) => payment.status === "paid")
      .reduce((total, payment) => total + Math.round(Number(payment.amountVND ?? Number(payment.amountUSDC) * USDC_VND_RATE)), 0);
    const paidPayment = relatedPayments.find((payment) => payment.status === "paid" && payment.txHash);
    const pendingPayment = relatedPayments.find((payment) => payment.status === "pending");
    const failedPayment = relatedPayments.find((payment) => payment.status === "failed");
    const cancelledPayment = relatedPayments.find((payment) => payment.status === "cancelled");
    const paid = currentShareVND > 0 && paidAmountVND >= currentShareVND;
    const status: "unpaid" | "pending" | "paid" | "failed" | "cancelled" = paid
      ? "paid"
      : pendingPayment
        ? "pending"
        : failedPayment
          ? "failed"
          : cancelledPayment
            ? "cancelled"
            : "unpaid";
    const canPay = Boolean(
      currentMember &&
        involved &&
        !receiverIsCurrentUser &&
        !paid &&
        (status === "unpaid" || status === "failed") &&
        expense.status !== "voided" &&
        expense.status !== "deleted"
    );
    const receiverName = isTreasuryMemberId(receiverMemberId) ? "Group treasury" : receiver?.displayName ?? "Member";
    const toWalletAddress = isTreasuryMemberId(receiverMemberId) ? treasury?.walletAddress ?? "" : receiver?.walletAddress ?? "";

    return {
      shares,
      receiverMemberId,
      receiverName,
      currentShareVND,
      currentShareUSDC,
      involved,
      receiverIsCurrentUser,
      paidPayment,
      pendingPayment,
      failedPayment,
      cancelledPayment,
      paid,
      canPay,
      status,
      toWalletAddress
    };
  }, [currentMember, expense, members, payments, treasuries]);

  if (!expense || !group || !detail) {
    return (
      <BottomSheet open={open} title="Expense detail" onClose={onClose}>
        <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
          This expense is no longer available.
        </div>
      </BottomSheet>
    );
  }

  const activeExpense = expense;
  const activeGroup = group;
  const activeDetail = detail;
  const payerName = activeDetail.receiverName;
  const userAmountLabel = getUserAmountLabel(activeExpense, activeDetail);
  const receiptUrl = (activeExpense as Expense & { receiptUrl?: string }).receiptUrl;
  const txUrl = activeDetail.paidPayment?.txHash ? getArcExplorerTxUrl(activeDetail.paidPayment.txHash) : undefined;

  function payNow() {
    if (activeDetail.status !== "unpaid" && activeDetail.status !== "failed") {
      setActionError(activeDetail.status === "pending" ? "This payment is already being processed." : "This payment cannot be paid again.");
      return;
    }

    if (!currentMember) {
      setActionError("Connect or join this group before paying.");
      return;
    }

    if (!activeDetail.toWalletAddress) {
      setActionError("The receiver wallet is missing. Ask the receiver to connect a wallet.");
      return;
    }

    const error = onPayNow({
      id: `expense_${activeExpense.id}_${currentMember.id}`,
      expenseId: activeExpense.id,
      balanceId: `expense_${activeExpense.id}_${currentMember.id}_${activeDetail.receiverMemberId}`,
      groupId: activeGroup.id,
      groupName: activeGroup.name,
      fromMemberId: currentMember.id,
      toMemberId: activeDetail.receiverMemberId,
      toName: payerName,
      toWalletAddress: activeDetail.toWalletAddress,
      fromWalletAddress: currentWalletAddress || currentMember.walletAddress || "",
      amountUSDC: activeDetail.currentShareUSDC,
      amountVND: activeDetail.currentShareVND,
      note: activeExpense.title
    });

    if (error) {
      setActionError(error);
      return;
    }

    setActionError(undefined);
  }

  return (
    <BottomSheet open={open} title="Expense detail" subtitle={activeGroup.name} onClose={onClose} fullHeight>
      <div className="space-y-4">
        <div className="surface-row rounded-[22px] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--cream-soft)]">
              <ReceiptText size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">{activeExpense.category}</p>
              <h3 className="mt-1 font-display text-xl font-bold">{activeExpense.title}</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Paid by {payerName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <MiniMetric label="Total" value={formatVND(activeExpense.amountVND)} supporting={formatUSDC(activeExpense.amountUSDC)} />
            <MiniMetric label="Your part" value={userAmountLabel} supporting={getPaymentStatusLabel(activeDetail.status)} tone={activeDetail.status === "paid" ? "success" : activeDetail.status === "failed" ? "warning" : undefined} />
          </div>
        </div>

        <DetailSection title="Split details">
          <InfoRow label="Split mode" value={activeExpense.splitMode} />
          <InfoRow label="Expense date" value={formatDateLabel(getExpenseDate(activeExpense), activeExpense.createdAt)} />
          <InfoRow label="Created" value={formatTime(activeExpense.createdAt)} />
          <InfoRow label="Updated" value={formatTime(activeExpense.updatedAt)} />
          <InfoRow label="Created by" value={members.find((member) => member.userId === activeExpense.createdBy)?.displayName ?? "Member"} />
          {activeExpense.note ? <InfoRow label="Note" value={activeExpense.note} /> : null}
          {receiptUrl ? (
            <a className="surface-row focus-ring flex min-h-[54px] items-center justify-between rounded-[18px] px-4 text-sm font-semibold" href={receiptUrl} target="_blank" rel="noreferrer">
              Receipt
              <ExternalLink size={16} />
            </a>
          ) : (
            <InfoRow label="Receipt" value="No receipt attached" />
          )}
        </DetailSection>

        <DetailSection title="Participants">
          {activeExpense.participants.map((memberId) => {
            const member = members.find((item) => item.id === memberId);
            const amountVND = activeDetail.shares[memberId] ?? 0;
            const role = memberId === activeExpense.paidBy ? "Paid the bill" : memberId === currentMember?.id ? "You owe" : "Share";

            return (
              <div key={memberId} className="surface-row flex min-h-[58px] items-center justify-between gap-3 rounded-[18px] px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{member?.displayName ?? "Member"}</span>
                  <span className="block text-xs text-[var(--text-muted)]">{role}</span>
                </span>
                <span className="number shrink-0 text-sm font-bold">{formatUSDC(toUSDC(amountVND))}</span>
              </div>
            );
          })}
        </DetailSection>

        <DetailSection title="Payment status">
          <InfoRow label="Status" value={getPaymentStatusLabel(activeDetail.status)} />
          {activeDetail.pendingPayment ? <InfoRow label="Pending" value={formatTime(activeDetail.pendingPayment.updatedAt)} /> : null}
          {activeDetail.failedPayment ? <InfoRow label="Failed" value={formatTime(activeDetail.failedPayment.updatedAt)} /> : null}
          {activeDetail.cancelledPayment ? <InfoRow label="Cancelled" value={formatTime(activeDetail.cancelledPayment.updatedAt)} /> : null}
          {activeDetail.paidPayment?.txHash ? <InfoRow label="Tx hash" value={shortAddress(activeDetail.paidPayment.txHash)} mono /> : null}
          {txUrl ? (
            <a className="surface-row focus-ring flex min-h-[54px] items-center justify-between rounded-[18px] px-4 text-sm font-semibold" href={txUrl} target="_blank" rel="noreferrer">
              View transaction
              <ExternalLink size={16} />
            </a>
          ) : null}
        </DetailSection>

        {actionError ? (
          <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
            {actionError}
          </div>
        ) : null}

        <div className="grid gap-3">
          {activeDetail.canPay ? (
            <Button fullWidth icon={<WalletCards size={17} />} onClick={payNow}>
              {activeDetail.status === "failed" ? "Retry payment" : "Pay now"}
            </Button>
          ) : null}
          {activeDetail.status === "pending" ? (
            <Button fullWidth variant="secondary" icon={<WalletCards size={17} />} disabled>
              Payment pending
            </Button>
          ) : null}
          {activeDetail.status === "paid" ? (
            <Button fullWidth variant="secondary" icon={<WalletCards size={17} />} disabled>
              Paid
            </Button>
          ) : null}
          {canEdit ? (
            <Button fullWidth variant="secondary" icon={<Pencil size={17} />} onClick={() => onEdit(activeExpense)}>
              Edit expense
            </Button>
          ) : null}
          {canDelete ? (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="muted" icon={<Ban size={16} />} onClick={() => onVoid(activeExpense)} disabled={activeExpense.status === "voided" || activeExpense.status === "deleted"}>
                Void
              </Button>
              <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => onDelete(activeExpense)} disabled={activeExpense.status === "deleted"}>
                Delete
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}

function getUserAmountLabel(
  expense: Expense,
  detail: {
    currentShareVND: number;
    currentShareUSDC: string;
    involved: boolean;
    receiverIsCurrentUser: boolean;
    paid: boolean;
  }
) {
  if (detail.receiverIsCurrentUser) {
    return `You paid ${formatUSDC(expense.amountUSDC)}`;
  }

  if (!detail.involved) {
    return "Not included";
  }

  if (detail.paid) {
    return "Paid";
  }

  return `You owe ${formatUSDC(detail.currentShareUSDC)}`;
}

function getPaymentStatusLabel(status: "unpaid" | "pending" | "paid" | "failed" | "cancelled") {
  if (status === "paid") {
    return "Paid";
  }

  if (status === "pending") {
    return "Payment pending";
  }

  if (status === "failed") {
    return "Payment failed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  return "Unpaid";
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 font-display text-lg font-bold">{title}</h4>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function MiniMetric({
  label,
  value,
  supporting,
  tone
}: {
  label: string;
  value: string;
  supporting?: string;
  tone?: "success" | "warning";
}) {
  return (
    <div className="surface-row min-w-0 rounded-[18px] p-3">
      <p className="truncate text-xs font-semibold text-[var(--text-muted)]">{label}</p>
      <p className={["mt-1 truncate text-sm font-bold", tone === "success" ? "text-[var(--success)]" : "", tone === "warning" ? "text-[var(--warning)]" : ""].join(" ")}>
        {value}
      </p>
      {supporting ? <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{supporting}</p> : null}
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="surface-row flex min-h-[54px] items-center justify-between gap-3 rounded-[18px] px-4 py-3 text-sm">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={[mono ? "number" : "", "min-w-0 text-right font-semibold"].join(" ")}>{value}</span>
    </div>
  );
}
