import { ArrowLeft, Plus, QrCode, Settings, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { AddExpenseSheet } from "../components/expenses/AddExpenseSheet";
import { ExpenseCard } from "../components/expenses/ExpenseCard";
import { ExpenseDetailSheet } from "../components/expenses/ExpenseDetailSheet";
import { AddMemberSheet } from "../components/groups/AddMemberSheet";
import { GroupManageSheet } from "../components/groups/GroupManageSheet";
import { MemberList } from "../components/groups/MemberList";
import { PermissionEditor } from "../components/groups/PermissionEditor";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { permissionPresets } from "../data/mockData";
import { formatUSDC, formatVND, shortAddress } from "../lib/format";
import type { Expense, GroupMember, Payment, PaymentRequest } from "../models";
import { calculateMemberNetBalances, getExpenseShareAmounts, getTreasuryMemberId, isTreasuryMemberId, USDC_VND_RATE } from "../services/balanceService";
import { getExpenseDate } from "../services/expenseService";
import { canCreateExpense, canEditExpense, canInviteMembers, canManageMembers, getCurrentMember, roleOptionsForActor } from "../services/groupService";
import { useGroupStore } from "../state/useGroupStore";
import { useSettingsStore } from "../state/useSettingsStore";

type GroupDetailPageProps = {
  groupId: string;
  addExpenseOpen: boolean;
  onBack: () => void;
  onOpenAddExpense: () => void;
  onCloseAddExpense: () => void;
  onOpenQR: (mode?: "scan" | "myqr" | "payload" | "invite") => void;
  selectedExpenseId?: string;
  selectedPaymentId?: string;
  onSelectExpense: (expenseId?: string, options?: { replace?: boolean }) => void;
  onOpenPayment: (request: PaymentRequest) => string | undefined;
};

export function GroupDetailPage({
  groupId,
  addExpenseOpen,
  onBack,
  onOpenAddExpense,
  onCloseAddExpense,
  onOpenQR,
  selectedExpenseId,
  selectedPaymentId,
  onSelectExpense,
  onOpenPayment
}: GroupDetailPageProps) {
  const {
    addMember,
    archiveGroup,
    balances,
    changeMemberRole,
    createExpense,
    currentUser,
    deleteExpense,
    deleteGroup,
    editGroup,
    editExpense,
    expenses,
    globalSummary,
    groups,
    members: allMembers,
    payments,
    treasuries,
    voidExpense
  } = useGroupStore();
  const { primaryWallet } = useSettingsStore();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense>();
  const [manageOpen, setManageOpen] = useState(false);
  const group = groups.find((item) => item.id === groupId);

  if (!group) {
    return (
      <main className="screen-pad space-y-6">
        <header className="flex items-center gap-4">
          <Button aria-label="Back to groups" variant="muted" size="icon" onClick={onBack}>
            <ArrowLeft size={19} />
          </Button>
          <div>
            <p className="text-sm font-medium text-[var(--text-muted)]">Group</p>
            <h1 className="font-display text-[28px] font-bold">Not found</h1>
          </div>
        </header>
        <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
          This group is no longer available. Go back to Groups and choose an active group.
        </div>
      </main>
    );
  }

  const members = allMembers.filter((member) => member.groupId === group.id);
  const currentMember = getCurrentMember(allMembers, group.id, currentUser.id);
  const canAddExpenses = canCreateExpense(currentMember);
  const canManage = canManageMembers(currentMember);
  const canInvite = canInviteMembers(currentMember);
  const canDeleteExpenses = Boolean(currentMember?.permissions.canDeleteExpenses || canManage);
  const groupExpenses = expenses.filter((expense) => expense.groupId === group.id);
  const groupPayments = payments.filter((payment) => payment.groupId === group.id);
  const groupBalances = balances.filter((balance) => balance.groupId === group.id);
  const visibleBalances = currentMember?.permissions.canViewAllBalances
    ? groupBalances
    : groupBalances.filter((balance) => balance.fromMemberId === currentMember?.id || balance.toMemberId === currentMember?.id);
  const netBalances = calculateMemberNetBalances(visibleBalances, members);
  const summary = globalSummary.groups.find((item) => item.groupId === group.id);
  const treasury = treasuries.find((item) => item.groupId === group.id);
  const selectedPayment = selectedPaymentId ? groupPayments.find((payment) => payment.id === selectedPaymentId) : undefined;
  const highlightedExpenseId = selectedExpenseId ?? selectedPayment?.expenseId;
  const selectedExpense = selectedExpenseId ? groupExpenses.find((expense) => expense.id === selectedExpenseId) : undefined;
  const activeExpenses = sortExpensesByDate(groupExpenses.filter((expense) => expense.status === "active" || expense.status === "edited"));
  const archivedExpenses = sortExpensesByDate(groupExpenses.filter((expense) => expense.status === "voided" || expense.status === "deleted"));
  const needAttentionExpenses = activeExpenses.filter((expense) => expenseNeedsAttention(expense, currentMember?.id, groupPayments));
  const completedExpenses = activeExpenses.filter((expense) => !needAttentionExpenses.some((item) => item.id === expense.id));

  function openCreateExpense() {
    setEditingExpense(undefined);
    onOpenAddExpense();
  }

  function openEditExpense(expense: Expense) {
    setEditingExpense(expense);
    onSelectExpense(undefined, { replace: true });
    onOpenAddExpense();
  }

  function closeExpenseSheet() {
    setEditingExpense(undefined);
    onCloseAddExpense();
  }

  function removeExpense(expense: Expense, mode: "void" | "delete") {
    const confirmed = window.confirm(mode === "void" ? "Void this expense? Balances will be recalculated." : "Delete this expense? It stays in history but is removed from active balances.");

    if (!confirmed) {
      return;
    }

    const result = mode === "void" ? voidExpense(expense.id) : deleteExpense(expense.id);

    if (!result.ok) {
      window.alert(result.message ?? "Could not update expense.");
      return;
    }

    onSelectExpense(undefined, { replace: true });
  }

  function renderExpenseCard(expense: Expense) {
    return (
      <ExpenseCard
        key={expense.id}
        expense={expense}
        members={members}
        payments={groupPayments}
        currentMemberId={currentMember?.id}
        highlighted={highlightedExpenseId === expense.id}
        onOpen={() => onSelectExpense(expense.id)}
      />
    );
  }

  return (
    <main className="screen-pad space-y-6">
      <header className="flex items-center justify-between gap-4">
        <Button aria-label="Back to groups" variant="muted" size="icon" onClick={onBack}>
          <ArrowLeft size={19} />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium capitalize text-[var(--text-muted)]">{group.type} group</p>
          <h1 className="truncate font-display text-[28px] font-bold">{group.name}</h1>
        </div>
      </header>

      <Card>
        <div className="grid grid-cols-3 gap-2">
          <Metric label="Members" value={String(members.length)} />
          <Metric label="You owe" value={formatUSDC(summary?.owesUSDC ?? "0.00")} warning />
          <Metric label="Receive" value={formatUSDC(summary?.receivesUSDC ?? "0.00")} success />
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--row-bg)]">
          <div className="h-full rounded-full bg-[var(--arc-accent)]" style={{ width: `${summary?.paidPercent ?? 0}%` }} />
        </div>
        <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">{summary?.paidPercent ?? 0}% of open payments are complete</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Button icon={<Plus size={18} />} onClick={openCreateExpense} disabled={!canAddExpenses}>
          Add expense
        </Button>
        <Button variant="secondary" icon={<QrCode size={18} />} onClick={() => onOpenQR("invite")} disabled={!canInvite}>
          Invite QR
        </Button>
      </div>
      {canManage ? (
        <Button fullWidth variant="muted" icon={<Settings size={18} />} onClick={() => setManageOpen(true)}>
          Manage group
        </Button>
      ) : null}

      {!canAddExpenses ? (
        <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
          Your current role can view this group but cannot add expenses.
        </div>
      ) : null}

      <Section title="Need attention / Unpaid" action={canAddExpenses ? "Add" : undefined} onAction={openCreateExpense}>
        <div className="space-y-3">
          {needAttentionExpenses.length > 0 ? needAttentionExpenses.map(renderExpenseCard) : <EmptyBlock title="No unpaid expenses" detail="New bills you owe will appear here." />}
        </div>
      </Section>

      <Section title="Paid / Completed">
        <div className="space-y-3">
          {completedExpenses.length > 0 ? completedExpenses.map(renderExpenseCard) : <EmptyBlock title="Completed payments will appear here" detail="Paid or informational expenses stay below unpaid items." />}
        </div>
      </Section>

      {archivedExpenses.length > 0 ? (
        <Section title="Voided / Deleted">
          <div className="space-y-3">{archivedExpenses.map(renderExpenseCard)}</div>
        </Section>
      ) : null}

      <Section title="Members" action={canManage ? "Add" : undefined} onAction={() => setAddMemberOpen(true)}>
        <MemberList members={members} compact />
      </Section>

      <Section title="Treasury">
        {treasury?.enabled ? (
          <div className="surface-row rounded-[20px] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
                  <ShieldCheck size={17} />
                  Shared balance
                </div>
                <p className="number mt-3 text-2xl font-bold">{formatUSDC(treasury.balanceUSDC ?? "0.00")}</p>
                <p className="text-sm text-[var(--text-muted)]">{formatVND(treasury.balanceVND ?? 0)}</p>
              </div>
              <span className="number text-xs text-[var(--text-muted)]">{shortAddress(treasury.walletAddress)}</span>
            </div>
          </div>
        ) : (
          <div className="surface-row rounded-[20px] p-4 text-sm text-[var(--text-secondary)]">Treasury is off for this group.</div>
        )}
      </Section>

      <Section title="Permission management">
        <PermissionEditor
          members={members}
          presets={permissionPresets}
          actorMemberId={currentMember?.id}
          canManage={canManage}
          assignableRoles={roleOptionsForActor(currentMember)}
          onChangeRole={(memberId, role) => changeMemberRole(group.id, memberId, role)}
        />
      </Section>

      <Card>
        <h2 className="font-display text-lg font-bold">Open balances</h2>
        {!currentMember?.permissions.canViewAllBalances ? (
          <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">Showing balances tied to your member only.</p>
        ) : null}
        <div className="mt-3 space-y-2">
          {visibleBalances.length > 0 ? (
            visibleBalances.map((balance) => (
              <div key={balance.id} className="surface-row flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                <span className="text-[var(--text-secondary)]">
                  {memberName(balance.fromMemberId, members)} pays {memberName(balance.toMemberId, members)}
                </span>
                <span className="number font-bold">{formatUSDC(balance.amountUSDC)}</span>
              </div>
            ))
          ) : (
            <EmptyBlock title="No open balances" detail="Paid or done groups stay clear here." />
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Member net balances</h2>
        <div className="mt-3 space-y-2">
          {netBalances.length > 0 ? (
            netBalances.map((item) => (
              <div key={item.memberId} className="surface-row flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                <span className="font-semibold text-[var(--text-secondary)]">{item.displayName}</span>
                <span className={["number font-bold", item.netVND >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]"].join(" ")}>
                  {formatUSDC(item.netUSDC, { signed: true })}
                </span>
              </div>
            ))
          ) : (
            <EmptyBlock title="No member balances" detail="Balances appear after members share an expense." />
          )}
        </div>
      </Card>

      <AddExpenseSheet
        open={addExpenseOpen}
        group={group}
        members={members}
        expense={editingExpense}
        onClose={closeExpenseSheet}
        onSave={(draft) => (editingExpense ? editExpense(editingExpense.id, draft) : createExpense(group.id, draft))}
      />
      <AddMemberSheet
        open={addMemberOpen}
        roleOptions={roleOptionsForActor(currentMember)}
        onClose={() => setAddMemberOpen(false)}
        onSave={(input) => addMember(group.id, input)}
      />
      <ExpenseDetailSheet
        open={Boolean(selectedExpenseId)}
        expense={selectedExpense}
        group={group}
        members={members}
        payments={groupPayments}
        treasuries={treasuries}
        currentMember={currentMember}
        currentWalletAddress={primaryWallet.address}
        canEdit={Boolean(selectedExpense && canEditExpense(currentMember, selectedExpense.createdBy, currentUser.id))}
        canDelete={canDeleteExpenses}
        onClose={() => onSelectExpense(undefined, { replace: true })}
        onEdit={openEditExpense}
        onVoid={(expense) => removeExpense(expense, "void")}
        onDelete={(expense) => removeExpense(expense, "delete")}
        onPayNow={onOpenPayment}
      />
      <GroupManageSheet
        open={manageOpen}
        group={group}
        onClose={() => setManageOpen(false)}
        onSave={(draft) => editGroup(group.id, draft)}
        onArchive={() => {
          const result = archiveGroup(group.id);
          if (result.ok) {
            onBack();
          }
          return result;
        }}
        onDelete={() => {
          const result = deleteGroup(group.id);
          if (result.ok) {
            onBack();
          }
          return result;
        }}
      />
    </main>
  );
}

function EmptyBlock({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="surface-row rounded-[18px] p-4">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function memberName(memberId: string, members: GroupMember[]) {
  if (isTreasuryMemberId(memberId)) {
    return "Group treasury";
  }

  return members.find((member) => member.id === memberId)?.displayName ?? "Member";
}

function expenseNeedsAttention(expense: Expense, currentMemberId: string | undefined, payments: Payment[]) {
  if (expense.status !== "active" && expense.status !== "edited") {
    return false;
  }

  if (!currentMemberId) {
    return true;
  }

  const receiverId = expense.splitMode === "treasury" ? getTreasuryMemberId(expense.groupId) : expense.paidBy;

  if (receiverId === currentMemberId || !expense.participants.includes(currentMemberId)) {
    return false;
  }

  const shares = getExpenseShareAmounts(expense);
  const shareVND = Math.round(Number(shares[currentMemberId] ?? 0));

  if (shareVND <= 0) {
    return false;
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

  return paidVND < shareVND;
}

function sortExpensesByDate(expenses: Expense[]) {
  return [...expenses].sort((a, b) => {
    const dateDiff = getExpenseDate(b).localeCompare(getExpenseDate(a));

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return b.createdAt - a.createdAt;
  });
}

function Metric({ label, value, success, warning }: { label: string; value: string; success?: boolean; warning?: boolean }) {
  return (
    <div className="surface-row min-w-0 rounded-2xl p-3">
      <p className="truncate text-[11px] font-semibold text-[var(--text-muted)]">{label}</p>
      <p
        className={[
          "number mt-1 truncate text-sm font-bold",
          success ? "text-[var(--success)]" : "",
          warning ? "text-[var(--warning)]" : ""
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  action,
  onAction,
  children
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {action ? (
          <button type="button" className="text-sm font-semibold text-[var(--text-muted)]" onClick={onAction}>
            {action}
          </button>
        ) : null}
      </div>
      {children}
    </Card>
  );
}
