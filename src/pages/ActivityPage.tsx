import { ArrowDownLeft, ArrowUpRight, Clock3, ExternalLink, TriangleAlert } from "lucide-react";
import type { Payment } from "../models";
import { getArcExplorerTxUrl } from "../lib/arc";
import { formatTime, formatUSDC, formatVND, shortAddress } from "../lib/format";
import { useGroupStore } from "../state/useGroupStore";
import { useSettingsStore } from "../state/useSettingsStore";

type ActivityPageProps = {
  onOpenGroup: (groupId: string, context?: { expenseId?: string; paymentId?: string }) => void;
};

export function ActivityPage({ onOpenGroup }: ActivityPageProps) {
  const { currentUser, expenses, groups, members, payments } = useGroupStore();
  const { primaryWallet } = useSettingsStore();
  const currentMemberIds = new Set(members.filter((member) => member.userId === currentUser.id).map((member) => member.id));
  const walletAddress = primaryWallet.address.toLowerCase();
  const personalPayments = payments
    .filter((payment) => {
      const fromWallet = payment.fromWalletAddress.toLowerCase();
      const toWallet = payment.toWalletAddress.toLowerCase();

      return (
        (walletAddress && (fromWallet === walletAddress || toWallet === walletAddress)) ||
        currentMemberIds.has(payment.fromMemberId) ||
        currentMemberIds.has(payment.toMemberId)
      );
    })
    .sort((a, b) => getPaymentTimestamp(b) - getPaymentTimestamp(a));

  return (
    <main className="screen-pad space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--text-muted)]">Activity</p>
        <h1 className="font-display text-[28px] font-bold">Payment history</h1>
      </header>

      <section className="space-y-3">
        {personalPayments.length > 0 ? (
          personalPayments.map((payment) => {
            const group = groups.find((item) => item.id === payment.groupId);
            const expense = payment.expenseId ? expenses.find((item) => item.id === payment.expenseId) : undefined;
            const from = members.find((member) => member.id === payment.fromMemberId);
            const to = members.find((member) => member.id === payment.toMemberId);
            const sent =
              (walletAddress && payment.fromWalletAddress.toLowerCase() === walletAddress) ||
              currentMemberIds.has(payment.fromMemberId);
            const counterparty = sent ? to : from;

            return (
              <PaymentHistoryRow
                key={payment.id}
                payment={payment}
                sent={sent}
                counterpartyName={counterparty?.displayName ?? shortAddress(sent ? payment.toWalletAddress : payment.fromWalletAddress)}
                groupName={group?.name}
                expenseTitle={expense?.title ?? payment.note}
                onOpen={group ? () => onOpenGroup(group.id, { paymentId: payment.id, expenseId: payment.expenseId }) : undefined}
              />
            );
          })
        ) : (
          <div className="surface-row rounded-[20px] p-4">
            <p className="font-semibold">No onchain activity yet</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Payments you send or receive will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function PaymentHistoryRow({
  payment,
  sent,
  counterpartyName,
  groupName,
  expenseTitle,
  onOpen
}: {
  payment: Payment;
  sent: boolean;
  counterpartyName: string;
  groupName?: string;
  expenseTitle?: string;
  onOpen?: () => void;
}) {
  const txUrl = payment.txHash ? getArcExplorerTxUrl(payment.txHash) : undefined;
  const status = getStatusCopy(payment.status);

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : -1}
      className="surface-row focus-ring flex min-h-[88px] cursor-pointer items-center justify-between gap-3 rounded-[20px] p-4"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={[
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
            sent ? "bg-[var(--warning)]/10 text-[var(--warning)]" : "bg-[var(--success)]/10 text-[var(--success)]"
          ].join(" ")}
        >
          {sent ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{sent ? `Sent to ${counterpartyName}` : `Received from ${counterpartyName}`}</span>
          <span className="mt-1 block truncate text-sm text-[var(--text-muted)]">{expenseTitle ?? groupName ?? "ArcNest payment"}</span>
          <span className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
            {payment.status === "failed" ? <TriangleAlert size={13} /> : <Clock3 size={13} />}
            {status} · {formatTime(getPaymentTimestamp(payment))}
          </span>
          {groupName ? <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">{groupName}</span> : null}
        </span>
      </div>
      <div className="shrink-0 text-right">
        <p className="number font-bold">{formatUSDC(payment.amountUSDC)}</p>
        {payment.amountVND ? <p className="text-xs text-[var(--text-muted)]">{formatVND(payment.amountVND)}</p> : null}
        {txUrl ? (
          <a
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]"
            href={txUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            Tx <ExternalLink size={13} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function getPaymentTimestamp(payment: Payment) {
  return payment.confirmedAt ?? payment.failedAt ?? payment.updatedAt ?? payment.createdAt;
}

function getStatusCopy(status: Payment["status"]) {
  if (status === "paid") {
    return "Confirmed";
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

  return "Ready to pay";
}
