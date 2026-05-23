import { WalletCard } from "../components/wallet/WalletCard";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PayButton } from "../components/payments/PayButton";
import { formatDisplayAmount, formatUSDC, formatVND } from "../lib/format";
import type { Balance, PaymentRequest } from "../models";
import { getBalanceRecipientWallet, isTreasuryMemberId } from "../services/balanceService";
import { canPayBalance, getCurrentMember } from "../services/groupService";
import { useGroupStore } from "../state/useGroupStore";
import { useSettingsStore } from "../state/useSettingsStore";

type HomePageProps = {
  onOpenQR: (mode?: "scan" | "myqr" | "payload" | "invite") => void;
  onOpenPayment: (request: PaymentRequest) => void;
  onOpenSend: () => void;
  onGoHome?: () => void;
  onGoToSplit: () => void;
};

export function HomePage({ onOpenQR, onOpenPayment, onOpenSend, onGoHome, onGoToSplit }: HomePageProps) {
  const { balances, currentUser, globalSummary, members, groups, treasuries, wallet } = useGroupStore();
  const { displayCurrency, primaryWallet } = useSettingsStore();
  const currentMemberIds = new Set(members.filter((member) => member.userId === currentUser.id).map((member) => member.id));
  const needToPay = balances.filter((balance) => currentMemberIds.has(balance.fromMemberId) && balance.status !== "paid");
  const needToReceive = balances.filter((balance) => currentMemberIds.has(balance.toMemberId) && balance.status !== "paid");

  return (
    <main className="screen-pad space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">Shared payments</p>
          <button type="button" className="focus-ring rounded-lg text-left font-display text-[28px] font-bold" onClick={onGoHome}>
            ArcNest
          </button>
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
              treasuries={treasuries}
              walletAddress={primaryWallet.address}
              currentUserId={currentUser.id}
              displayCurrency={displayCurrency}
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
              treasuries={treasuries}
              walletAddress={primaryWallet.address}
              currentUserId={currentUser.id}
              displayCurrency={displayCurrency}
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
  treasuries,
  walletAddress,
  currentUserId,
  displayCurrency,
  onOpenPayment
}: {
  balance: Balance;
  type: "pay" | "receive";
  groups: ReturnType<typeof useGroupStore>["groups"];
  members: ReturnType<typeof useGroupStore>["members"];
  treasuries: ReturnType<typeof useGroupStore>["treasuries"];
  walletAddress: string;
  currentUserId: string;
  displayCurrency: ReturnType<typeof useSettingsStore>["displayCurrency"];
  onOpenPayment: (request: PaymentRequest) => void;
}) {
  const group = groups.find((item) => item.id === balance.groupId);
  const from = members.find((member) => member.id === balance.fromMemberId);
  const to = members.find((member) => member.id === balance.toMemberId);
  const currentMember = group ? getCurrentMember(members, group.id, currentUserId) : undefined;
  const payAllowed = canPayBalance(currentMember);
  const counterparty = type === "pay" ? to : from;
  const counterpartyName = isTreasuryMemberId(balance.toMemberId) ? "Group treasury" : counterparty?.displayName ?? "Member";
  const toWalletAddress = getBalanceRecipientWallet(balance, members, treasuries);

  return (
    <div className="surface-row flex min-h-[76px] items-center justify-between gap-3 rounded-[20px] p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold">{type === "pay" ? `Pay ${counterpartyName}` : `${counterparty?.displayName ?? "Member"} pays you`}</p>
        <p className="truncate text-sm text-[var(--text-muted)]">{group?.name}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {displayCurrency === "USDC" ? formatVND(balance.amountVND) : formatDisplayAmount(balance.amountVND, displayCurrency)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="number mb-2 font-bold">{formatUSDC(balance.amountUSDC)}</p>
        {type === "pay" ? (
          <PayButton
            onClick={() =>
              onOpenPayment({
                id: balance.id,
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
          />
        ) : null}
      </div>
    </div>
  );
}
