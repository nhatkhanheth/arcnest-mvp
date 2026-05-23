import { ArrowLeft, Plus, QrCode, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { AddExpenseSheet } from "../components/expenses/AddExpenseSheet";
import { ExpenseCard } from "../components/expenses/ExpenseCard";
import { AddMemberSheet } from "../components/groups/AddMemberSheet";
import { MemberList } from "../components/groups/MemberList";
import { PermissionEditor } from "../components/groups/PermissionEditor";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { permissionPresets } from "../data/mockData";
import { formatUSDC, formatVND, shortAddress } from "../lib/format";
import type { Expense, GroupMember } from "../models";
import { calculateMemberNetBalances, isTreasuryMemberId } from "../services/balanceService";
import { canCreateExpense, canEditExpense, canInviteMembers, canManageMembers, getCurrentMember, roleOptionsForActor } from "../services/groupService";
import { useGroupStore } from "../state/useGroupStore";

type GroupDetailPageProps = {
  groupId: string;
  addExpenseOpen: boolean;
  onBack: () => void;
  onOpenAddExpense: () => void;
  onCloseAddExpense: () => void;
  onOpenQR: (mode?: "scan" | "myqr" | "payload" | "invite") => void;
};

export function GroupDetailPage({
  groupId,
  addExpenseOpen,
  onBack,
  onOpenAddExpense,
  onCloseAddExpense,
  onOpenQR
}: GroupDetailPageProps) {
  const {
    addMember,
    balances,
    changeMemberRole,
    createExpense,
    currentUser,
    editExpense,
    expenses,
    globalSummary,
    groups,
    members: allMembers,
    treasuries
  } = useGroupStore();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense>();
  const group = groups.find((item) => item.id === groupId) ?? groups[0];
  const members = allMembers.filter((member) => member.groupId === group.id);
  const currentMember = getCurrentMember(allMembers, group.id, currentUser.id);
  const canAddExpenses = canCreateExpense(currentMember);
  const canManage = canManageMembers(currentMember);
  const canInvite = canInviteMembers(currentMember);
  const groupExpenses = expenses.filter((expense) => expense.groupId === group.id);
  const groupBalances = balances.filter((balance) => balance.groupId === group.id);
  const visibleBalances = currentMember?.permissions.canViewAllBalances
    ? groupBalances
    : groupBalances.filter((balance) => balance.fromMemberId === currentMember?.id || balance.toMemberId === currentMember?.id);
  const netBalances = calculateMemberNetBalances(visibleBalances, members);
  const summary = globalSummary.groups.find((item) => item.groupId === group.id);
  const treasury = treasuries.find((item) => item.groupId === group.id);

  function openCreateExpense() {
    setEditingExpense(undefined);
    onOpenAddExpense();
  }

  function openEditExpense(expense: Expense) {
    setEditingExpense(expense);
    onOpenAddExpense();
  }

  function closeExpenseSheet() {
    setEditingExpense(undefined);
    onCloseAddExpense();
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

      {!canAddExpenses ? (
        <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
          Your current role can view this group but cannot add expenses.
        </div>
      ) : null}

      <Section title="Expenses" action={canAddExpenses ? "Add" : undefined} onAction={openCreateExpense}>
        <div className="space-y-3">
          {groupExpenses.length > 0 ? (
            groupExpenses.map((expense) => (
              <ExpenseCard
                key={expense.id}
                expense={expense}
                members={members}
                canEdit={canEditExpense(currentMember, expense.createdBy, currentUser.id)}
                onEdit={() => openEditExpense(expense)}
              />
            ))
          ) : (
            <EmptyBlock title="No expenses yet" detail="Add the first shared expense to calculate balances." />
          )}
        </div>
      </Section>

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
            <EmptyBlock title="No open balances" detail="Paid or settled groups stay clear here." />
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
