import { QrCode, Settings } from "lucide-react";
import { useConnection } from "wagmi";
import { WalletCard } from "../components/wallet/WalletCard";
import { AppLogo } from "../components/app/AppLogo";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PayButton } from "../components/payments/PayButton";
import { arcNetwork, getArcPaymentMode, isWrongArcNetwork } from "../lib/arc";
import { APP_VERSION } from "../lib/appMeta";
import { formatDisplayAmount, formatUSDC, formatVND } from "../lib/format";
import type { Balance, Payment, PaymentRequest } from "../models";
import { getBalanceRecipientWallet, isTreasuryMemberId } from "../services/balanceService";
import { canPayBalance, getCurrentMember } from "../services/groupService";
import { useGroupStore } from "../state/useGroupStore";
import { useSettingsStore } from "../state/useSettingsStore";

type HomePageProps = {
  onOpenQR: (mode?: "scan" | "myqr" | "payload" | "invite") => void;
  onOpenPayment: (request: PaymentRequest) => void;
  onOpenSend: () => void;
  onOpenSettings: () => void;
  syncLabel?: string;
  onGoHome?: () => void;
  onOpenGroup: (groupId: string, context?: { expenseId?: string; paymentId?: string }) => void;
  onGoToSplit: () => void;
};

export function HomePage({ onOpenQR, onOpenPayment, onOpenSend, onOpenSettings, syncLabel, onGoHome, onOpenGroup, onGoToSplit }: HomePageProps) {
  const connection = useConnection();
  const { balances, currentUser, globalSummary, members, groups, payments, treasuries, wallet } = useGroupStore();
  const { displayCurrency, primaryWallet } = useSettingsStore();
  const paymentMode = getArcPaymentMode();
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const wrongNetwork = paymentMode === "testnet" && connection.isConnected && isWrongArcNetwork(connection.chainId);
  const modeLabel = wrongNetwork ? "Wrong Network" : missingConfig ? "Demo Mode" : connection.isConnected ? "Arc Testnet" : "Testnet Ready";
  const currentMemberIds = new Set(members.filter((member) => member.userId === currentUser.id).map((member) => member.id));
  const activeGroupIds = new Set(groups.filter((group) => group.status === "active").map((group) => group.id));
  const needToPay = balances.filter((balance) => activeGroupIds.has(balance.groupId) && currentMemberIds.has(balance.fromMemberId) && balance.status !== "paid");
  const needToReceive = balances.filter((balance) => activeGroupIds.has(balance.groupId) && currentMemberIds.has(balance.toMemberId) && balance.status !== "paid");

  return (
    <main className="screen-pad space-y-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-[18px] text-left" onClick={onGoHome}>
            <AppLogo variant="header" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-[var(--text-muted)]">Shared payments</span>
              <span className="block truncate font-display text-[28px] font-bold leading-tight">ArcNest</span>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <Button aria-label="Open QR Pay" variant="muted" size="icon" className="h-10 w-10 rounded-[16px] bg-[var(--card-bg)]" onClick={() => onOpenQR("scan")}>
              <QrCode size={18} />
            </Button>
            <Button aria-label="Open settings" variant="muted" size="icon" className="h-10 w-10 rounded-[16px] bg-[var(--card-bg)]" onClick={onOpenSettings}>
              <Settings size={18} />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusChip label={modeLabel} tone={wrongNetwork ? "warning" : missingConfig ? "muted" : "active"} />
          {syncLabel ? <StatusChip label={syncLabel} /> : null}
          <StatusChip label={APP_VERSION} />
        </div>
      </header>

      <WalletCard wallet={wallet} onSend={onOpenSend} onReceive={() => onOpenQR("myqr")} />

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-muted)]">Across groups</p>
            <h2 className="mt-1 font-display text-lg font-bold">Your balance summary</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onGoToSplit}>
            View
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <SummaryBox label="You owe" value={formatUSDC(globalSummary.totalOwesUSDC)} tone="warning" />
          <SummaryBox label="You'll receive" value={formatUSDC(globalSummary.totalReceivesUSDC)} tone="success" />
          <SummaryBox label="Net" value={formatUSDC(globalSummary.netUSDC)} tone={Number(globalSummary.netUSDC) >= 0 ? "success" : "warning"} />
        </div>
        <div className="mt-4 space-y-3">
          {globalSummary.groups.map((item) => (
            <div key={item.groupId}>
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[var(--text-muted)]">
                <span>{item.groupName}</span>
                <span>{item.paidPercent}% paid</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--row-bg)]">
                <div className="h-full rounded-full bg-[var(--arc-accent)]" style={{ width: `${item.paidPercent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <section className="space-y-3">
        <SectionTitle title="Need to Pay" action="See all" onAction={onGoToSplit} />
        {needToPay.length > 0 ? (
          needToPay.map((balance) => (
            <BalanceRow
              key={balance.id}
              balance={balance}
              type="pay"
              groups={groups}
              members={members}
              payments={payments}
              treasuries={treasuries}
              walletAddress={primaryWallet.address}
              currentUserId={currentUser.id}
              displayCurrency={displayCurrency}
              onOpenGroup={onOpenGroup}
              onOpenPayment={onOpenPayment}
            />
          ))
        ) : (
          <EmptyRow title="No pending payments" detail="Create a group expense to generate balances." />
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Need to Receive" action="See all" onAction={onGoToSplit} />
        {needToReceive.length > 0 ? (
          needToReceive.map((balance) => (
            <BalanceRow
              key={balance.id}
              balance={balance}
              type="receive"
              groups={groups}
              members={members}
              payments={payments}
              treasuries={treasuries}
              walletAddress={primaryWallet.address}
              currentUserId={currentUser.id}
              displayCurrency={displayCurrency}
              onOpenGroup={onOpenGroup}
              onOpenPayment={onOpenPayment}
            />
          ))
        ) : (
          <EmptyRow title="Nothing to collect" detail="Incoming balances will appear here after expenses are split." />
        )}
      </section>
    </main>
  );
}

function StatusChip({ label, tone = "muted" }: { label: string; tone?: "active" | "warning" | "muted" }) {
  return (
    <span
      className={[
        "rounded-full border px-3 py-2 text-xs font-semibold",
        tone === "active" ? "border-[var(--border-soft)] bg-[var(--arc-soft)] text-[var(--text-primary)]" : "",
        tone === "warning" ? "border-[var(--warning)]/50 bg-[var(--warning)]/10 text-[var(--warning)]" : "",
        tone === "muted" ? "border-[var(--border-soft)] bg-[var(--card-bg)] text-[var(--text-muted)]" : ""
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function EmptyRow({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="surface-row rounded-[20px] p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function SummaryBox({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" }) {
  return (
    <div className="surface-row min-w-0 rounded-2xl p-3">
      <p className="truncate text-[11px] font-semibold text-[var(--text-muted)]">{label}</p>
      <p className={["number mt-1 truncate text-sm font-bold", tone === "success" ? "text-[var(--success)]" : "text-[var(--warning)]"].join(" ")}>
        {value}
      </p>
    </div>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <button type="button" className="text-sm font-semibold text-[var(--text-muted)]" onClick={onAction}>
        {action}
      </button>
    </div>
  );
}

function BalanceRow({
  balance,
  type,
  groups,
  members,
  payments,
  treasuries,
  walletAddress,
  currentUserId,
  displayCurrency,
  onOpenGroup,
  onOpenPayment
}: {
  balance: Balance;
  type: "pay" | "receive";
  groups: ReturnType<typeof useGroupStore>["groups"];
  members: ReturnType<typeof useGroupStore>["members"];
  payments: Payment[];
  treasuries: ReturnType<typeof useGroupStore>["treasuries"];
  walletAddress: string;
  currentUserId: string;
  displayCurrency: ReturnType<typeof useSettingsStore>["displayCurrency"];
  onOpenGroup: (groupId: string, context?: { expenseId?: string; paymentId?: string }) => void;
  onOpenPayment: (request: PaymentRequest) => void;
}) {
  const group = groups.find((item) => item.id === balance.groupId);
  const from = members.find((member) => member.id === balance.fromMemberId);
  const to = members.find((member) => member.id === balance.toMemberId);
  const currentMember = group ? getCurrentMember(members, group.id, currentUserId) : undefined;
  const payAllowed = canPayBalance(currentMember);
  const relatedPayment = getRelatedPayment(balance, payments);
  const counterparty = type === "pay" ? to : from;
  const counterpartyName = isTreasuryMemberId(balance.toMemberId) ? "Group treasury" : counterparty?.displayName ?? "Member";
  const toWalletAddress = getBalanceRecipientWallet(balance, members, treasuries);

  function openGroupDetails() {
    if (group) {
      onOpenGroup(group.id, { expenseId: balance.expenseId });
    }
  }

  return (
    <div
      role="button"
      tabIndex={group ? 0 : -1}
      className="surface-row focus-ring flex min-h-[76px] cursor-pointer items-center justify-between gap-3 rounded-[20px] p-4"
      onClick={openGroupDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openGroupDetails();
        }
      }}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{type === "pay" ? `Pay ${counterpartyName}` : `${counterparty?.displayName ?? "Member"} pays you`}</p>
        <p className="truncate text-sm text-[var(--text-muted)]">{group?.name}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {displayCurrency === "USDC" ? formatVND(balance.amountVND) : formatDisplayAmount(balance.amountVND, displayCurrency)}
        </p>
        <p className="mt-1 text-xs font-semibold text-[var(--text-muted)]">Tap to view group expenses</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="number mb-2 font-bold">{formatUSDC(balance.amountUSDC)}</p>
        {type === "pay" ? (
          <span onClick={(event) => event.stopPropagation()}>
            <PayButton
              onClick={() =>
                onOpenPayment({
                  id: balance.id,
                  expenseId: balance.expenseId,
                  balanceId: balance.id,
                  groupId: group?.id,
                  groupName: group?.name,
                  fromMemberId: balance.fromMemberId,
                  toMemberId: balance.toMemberId,
                  toName: counterpartyName,
                  toWalletAddress,
                  fromWalletAddress: walletAddress,
                  amountUSDC: balance.amountUSDC,
                  amountVND: balance.amountVND,
                  note: group?.name
                })
              }
              disabled={!payAllowed}
              status={relatedPayment?.status}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function getRelatedPayment(balance: Balance, payments: Payment[]) {
  const related = payments.filter(
    (payment) =>
      payment.groupId === balance.groupId &&
      payment.fromMemberId === balance.fromMemberId &&
      payment.toMemberId === balance.toMemberId &&
      (payment.balanceId === balance.id || payment.expenseId === balance.expenseId)
  );

  return related.find((payment) => payment.status === "pending") ?? related.find((payment) => payment.status === "paid") ?? related.find((payment) => payment.status === "failed") ?? related[0];
}
