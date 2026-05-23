import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { PayButton } from "../components/payments/PayButton";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Input";
import { formatDisplayAmount, formatUSDC, formatVND } from "../lib/format";
import type { Balance, PaymentRequest } from "../models";
import { getBalanceRecipientWallet, isTreasuryMemberId } from "../services/balanceService";
import { canPayBalance, getCurrentMember } from "../services/groupService";
import { useGroupStore } from "../state/useGroupStore";
import { useSettingsStore } from "../state/useSettingsStore";

type SplitPageProps = {
  onOpenPayment: (request: PaymentRequest) => void;
  onOpenGroup: (groupId: string, context?: { expenseId?: string; paymentId?: string }) => void;
};

export function SplitPage({ onOpenPayment, onOpenGroup }: SplitPageProps) {
  const { balances, currentUser, groups, members, treasuries } = useGroupStore();
  const { displayCurrency, primaryWallet } = useSettingsStore();
  const [groupFilter, setGroupFilter] = useState("all");
  const activeGroups = groups.filter((group) => group.status === "active");
  const activeGroupIds = new Set(activeGroups.map((group) => group.id));
  const currentMemberIds = useMemo(
    () => new Set(members.filter((member) => member.userId === currentUser.id).map((member) => member.id)),
    [currentUser.id, members]
  );

  const filteredBalances = balances.filter((balance) => activeGroupIds.has(balance.groupId) && (groupFilter === "all" || balance.groupId === groupFilter));
  const youOwe = filteredBalances.filter((balance) => currentMemberIds.has(balance.fromMemberId) && balance.status !== "paid");
  const youllReceive = filteredBalances.filter((balance) => currentMemberIds.has(balance.toMemberId) && balance.status !== "paid");

  const oweTotal = youOwe.reduce((total, balance) => total + Number(balance.amountUSDC), 0);
  const receiveTotal = youllReceive.reduce((total, balance) => total + Number(balance.amountUSDC), 0);

  return (
    <main className="screen-pad space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--text-muted)]">Split</p>
        <h1 className="font-display text-[28px] font-bold">Pay what is due</h1>
      </header>

      <Card>
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)]">
          <Filter size={16} />
          Group filter
        </div>
        <Select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
          <option value="all">All groups</option>
          {activeGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm font-semibold text-[var(--text-muted)]">You owe</p>
          <p className="number mt-2 text-2xl font-bold text-[var(--warning)]">{formatUSDC(oweTotal)}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-[var(--text-muted)]">You'll receive</p>
          <p className="number mt-2 text-2xl font-bold text-[var(--success)]">{formatUSDC(receiveTotal)}</p>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">You owe</h2>
        {youOwe.length > 0 ? (
          youOwe.map((balance) => (
            <SplitRow
              key={balance.id}
              balance={balance}
              mode="owe"
              groups={groups}
              members={members}
              treasuries={treasuries}
              walletAddress={primaryWallet.address}
              currentUserId={currentUser.id}
              displayCurrency={displayCurrency}
              onOpenPayment={onOpenPayment}
              onOpenGroup={onOpenGroup}
            />
          ))
        ) : (
          <EmptyRow title="No balances due" detail="New expenses will create payable balances here." />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">You'll receive</h2>
        {youllReceive.length > 0 ? (
          youllReceive.map((balance) => (
            <SplitRow
              key={balance.id}
              balance={balance}
              mode="receive"
              groups={groups}
              members={members}
              treasuries={treasuries}
              walletAddress={primaryWallet.address}
              currentUserId={currentUser.id}
              displayCurrency={displayCurrency}
              onOpenPayment={onOpenPayment}
              onOpenGroup={onOpenGroup}
            />
          ))
        ) : (
          <EmptyRow title="Nothing incoming" detail="When someone owes you, that balance will appear here." />
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

function SplitRow({
  balance,
  mode,
  groups,
  members,
  treasuries,
  walletAddress,
  currentUserId,
  displayCurrency,
  onOpenPayment,
  onOpenGroup
}: {
  balance: Balance;
  mode: "owe" | "receive";
  groups: ReturnType<typeof useGroupStore>["groups"];
  members: ReturnType<typeof useGroupStore>["members"];
  treasuries: ReturnType<typeof useGroupStore>["treasuries"];
  walletAddress: string;
  currentUserId: string;
  displayCurrency: ReturnType<typeof useSettingsStore>["displayCurrency"];
  onOpenPayment: (request: PaymentRequest) => void;
  onOpenGroup: (groupId: string, context?: { expenseId?: string; paymentId?: string }) => void;
}) {
  const group = groups.find((item) => item.id === balance.groupId);
  const from = members.find((member) => member.id === balance.fromMemberId);
  const to = members.find((member) => member.id === balance.toMemberId);
  const currentMember = group ? getCurrentMember(members, group.id, currentUserId) : undefined;
  const payAllowed = canPayBalance(currentMember);
  const displayName = mode === "owe" ? (isTreasuryMemberId(balance.toMemberId) ? "Group treasury" : to?.displayName) : from?.displayName;
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
      className="surface-row focus-ring flex min-h-[82px] cursor-pointer items-center justify-between gap-3 rounded-[20px] p-4"
      onClick={openGroupDetails}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openGroupDetails();
        }
      }}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{mode === "owe" ? `Pay ${displayName ?? "Member"}` : `${displayName ?? "Member"} pays you`}</p>
        <p className="truncate text-sm text-[var(--text-muted)]">{group?.name}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {displayCurrency === "USDC" ? formatVND(balance.amountVND) : formatDisplayAmount(balance.amountVND, displayCurrency)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="number mb-2 font-bold">{formatUSDC(balance.amountUSDC)}</p>
        {mode === "owe" ? (
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
                  toName: displayName ?? "Member",
                  toWalletAddress,
                  fromWalletAddress: walletAddress,
                  amountUSDC: balance.amountUSDC,
                  amountVND: balance.amountVND,
                  note: group?.name
                })
              }
              disabled={!payAllowed}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}
