import type { Balance, Expense, ExpenseShare, GlobalBalanceSummary, Group, GroupBalanceSummary, GroupMember, Payment, Treasury } from "../models";

export const USDC_VND_RATE = 25000;
export const TREASURY_MEMBER_PREFIX = "treasury:";

type DebtDraft = {
  groupId: string;
  expenseId: string;
  fromMemberId: string;
  toMemberId: string;
  amountVND: number;
};

export type MemberNetBalance = {
  memberId: string;
  displayName: string;
  owesVND: number;
  receivesVND: number;
  netVND: number;
  owesUSDC: string;
  receivesUSDC: string;
  netUSDC: string;
};

export function toUSDC(amountVND: number) {
  return (amountVND / USDC_VND_RATE).toFixed(2);
}

export function getTreasuryMemberId(groupId: string) {
  return `${TREASURY_MEMBER_PREFIX}${groupId}`;
}

export function isTreasuryMemberId(memberId: string) {
  return memberId.startsWith(TREASURY_MEMBER_PREFIX);
}

export function splitEvenly(totalVND: number, count: number) {
  if (count <= 0) {
    return [];
  }

  const base = Math.floor(totalVND / count);
  const remainder = totalVND - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function getExpenseShareAmounts(expense: Expense) {
  const participants = expense.participants;

  if (expense.splitAmountsVND) {
    return participants.reduce<Record<string, number>>((shares, memberId) => {
      shares[memberId] = Math.max(0, Math.round(Number(expense.splitAmountsVND?.[memberId] ?? 0)));
      return shares;
    }, {});
  }

  const equalShares = splitEvenly(expense.amountVND, participants.length);
  return participants.reduce<Record<string, number>>((shares, memberId, index) => {
    shares[memberId] = equalShares[index] ?? 0;
    return shares;
  }, {});
}

export function calculateExpenseSplits(expense: Expense, members: GroupMember[]): ExpenseShare[] {
  const memberById = new Map(members.map((member) => [member.id, member]));
  const shareAmounts = getExpenseShareAmounts(expense);

  return expense.participants.map((memberId) => {
    const amountVND = shareAmounts[memberId] ?? 0;
    return {
      memberId,
      displayName: memberById.get(memberId)?.displayName ?? "Member",
      amountVND,
      amountUSDC: toUSDC(amountVND),
      direction: expense.splitMode === "treasury" ? "treasury" : memberId === expense.paidBy ? "receives" : "owes"
    };
  });
}

export function calculateExpenseDebts(expense: Expense): DebtDraft[] {
  if (expense.status !== "active" && expense.status !== "edited") {
    return [];
  }

  const shareAmounts = getExpenseShareAmounts(expense);
  const toMemberId = expense.splitMode === "treasury" ? getTreasuryMemberId(expense.groupId) : expense.paidBy;

  return expense.participants
    .filter((memberId) => memberId !== toMemberId)
    .map((memberId) => ({
      groupId: expense.groupId,
      expenseId: expense.id,
      fromMemberId: memberId,
      toMemberId,
      amountVND: shareAmounts[memberId] ?? 0
    }))
    .filter((debt) => debt.amountVND > 0 && debt.fromMemberId !== debt.toMemberId);
}

export function calculateRawGroupDebtTotal(expenses: Expense[]) {
  return expenses
    .filter((expense) => expense.status === "active" || expense.status === "edited")
    .flatMap(calculateExpenseDebts)
    .reduce((total, debt) => total + debt.amountVND, 0);
}

export function calculatePaidPaymentTotal(payments: Payment[], groupId?: string) {
  return payments
    .filter((payment) => payment.status === "paid" && (!groupId || payment.groupId === groupId))
    .reduce((total, payment) => total + Math.round(Number(payment.amountVND ?? Number(payment.amountUSDC) * USDC_VND_RATE)), 0);
}

export function calculateGroupBalances(expenses: Expense[], payments: Payment[], _members: GroupMember[]): Balance[] {
  const aggregatedDebts = new Map<string, DebtDraft>();

  for (const debt of expenses.flatMap(calculateExpenseDebts)) {
    const key = balancePairKey(debt.groupId, debt.fromMemberId, debt.toMemberId);
    const current = aggregatedDebts.get(key);
    aggregatedDebts.set(key, current ? { ...current, amountVND: current.amountVND + debt.amountVND } : { ...debt });
  }

  const paidByPair = new Map<string, number>();
  for (const payment of payments) {
    if (payment.status !== "paid") {
      continue;
    }

    const key = balancePairKey(payment.groupId, payment.fromMemberId, payment.toMemberId);
    const amountVND = Math.round(Number(payment.amountVND ?? Number(payment.amountUSDC) * USDC_VND_RATE));
    paidByPair.set(key, (paidByPair.get(key) ?? 0) + amountVND);
  }

  const directedBalances: Balance[] = [];

  for (const [key, debt] of aggregatedDebts.entries()) {
    const paidVND = paidByPair.get(key) ?? 0;
    const remainingVND = Math.max(0, debt.amountVND - paidVND);

    if (remainingVND <= 0) {
      continue;
    }

    directedBalances.push({
      id: `balance_${key.replace(/:/g, "_")}`,
      groupId: debt.groupId,
      fromMemberId: debt.fromMemberId,
      toMemberId: debt.toMemberId,
      amountVND: remainingVND,
      amountUSDC: toUSDC(remainingVND),
      status: paidVND > 0 ? "partially_paid" : "unpaid"
    });
  }

  return netReciprocalBalances(directedBalances).sort((a, b) => b.amountVND - a.amountVND);
}

function netReciprocalBalances(balances: Balance[]) {
  const byPair = new Map<string, Balance[]>();

  for (const balance of balances) {
    const key = normalizedPairKey(balance.groupId, balance.fromMemberId, balance.toMemberId);
    byPair.set(key, [...(byPair.get(key) ?? []), balance]);
  }

  const netted: Balance[] = [];

  for (const pairBalances of byPair.values()) {
    if (pairBalances.length === 1) {
      netted.push(pairBalances[0]);
      continue;
    }

    const [first, second] = pairBalances;
    const firstNetVND = first.amountVND - second.amountVND;

    if (firstNetVND === 0) {
      continue;
    }

    const winner = firstNetVND > 0 ? first : second;
    const amountVND = Math.abs(firstNetVND);

    netted.push({
      ...winner,
      id: `balance_${winner.groupId}_${winner.fromMemberId}_${winner.toMemberId}`.replace(/:/g, "_"),
      amountVND,
      amountUSDC: toUSDC(amountVND)
    });
  }

  return netted;
}

export function calculateMemberNetBalances(balances: Balance[], members: GroupMember[]): MemberNetBalance[] {
  return members.map((member) => {
    const owesVND = balances
      .filter((balance) => balance.fromMemberId === member.id && balance.status !== "paid")
      .reduce((total, balance) => total + balance.amountVND, 0);
    const receivesVND = balances
      .filter((balance) => balance.toMemberId === member.id && balance.status !== "paid")
      .reduce((total, balance) => total + balance.amountVND, 0);
    const netVND = receivesVND - owesVND;

    return {
      memberId: member.id,
      displayName: member.displayName,
      owesVND,
      receivesVND,
      netVND,
      owesUSDC: toUSDC(owesVND),
      receivesUSDC: toUSDC(receivesVND),
      netUSDC: toUSDC(netVND)
    };
  });
}

export function calculateGroupSummary(
  group: Group,
  balances: Balance[],
  expenses: Expense[],
  payments: Payment[],
  currentMemberIds: Set<string>
): GroupBalanceSummary {
  const groupBalances = balances.filter((balance) => balance.groupId === group.id && balance.status !== "paid");
  const owesVND = groupBalances
    .filter((balance) => currentMemberIds.has(balance.fromMemberId))
    .reduce((total, balance) => total + balance.amountVND, 0);
  const receivesVND = groupBalances
    .filter((balance) => currentMemberIds.has(balance.toMemberId))
    .reduce((total, balance) => total + balance.amountVND, 0);
  const rawDebtVND = calculateRawGroupDebtTotal(expenses.filter((expense) => expense.groupId === group.id));
  const paidVND = Math.min(rawDebtVND, calculatePaidPaymentTotal(payments, group.id));
  const paidPercent = rawDebtVND > 0 ? Math.round((paidVND / rawDebtVND) * 100) : 100;

  return {
    groupId: group.id,
    groupName: group.name,
    owesUSDC: toUSDC(owesVND),
    receivesUSDC: toUSDC(receivesVND),
    netUSDC: toUSDC(receivesVND - owesVND),
    paidPercent
  };
}

export function calculateGlobalBalanceSummary(
  groups: Group[],
  balances: Balance[],
  expenses: Expense[],
  payments: Payment[],
  members: GroupMember[],
  currentUserId: string,
  walletUSDC: string
): GlobalBalanceSummary {
  const currentMemberIds = new Set(members.filter((member) => member.userId === currentUserId && member.status === "active").map((member) => member.id));
  const groupSummaries = groups
    .filter((group) => group.status === "active")
    .map((group) => calculateGroupSummary(group, balances, expenses, payments, currentMemberIds));
  const totalOwesVND = balances
    .filter((balance) => currentMemberIds.has(balance.fromMemberId) && balance.status !== "paid")
    .reduce((total, balance) => total + balance.amountVND, 0);
  const totalReceivesVND = balances
    .filter((balance) => currentMemberIds.has(balance.toMemberId) && balance.status !== "paid")
    .reduce((total, balance) => total + balance.amountVND, 0);

  return {
    totalWalletUSDC: walletUSDC,
    totalOwesUSDC: toUSDC(totalOwesVND),
    totalReceivesUSDC: toUSDC(totalReceivesVND),
    netUSDC: toUSDC(totalReceivesVND - totalOwesVND),
    groups: groupSummaries
  };
}

export function getBalanceRecipientWallet(balance: Balance, members: GroupMember[], treasuries: Treasury[]) {
  if (isTreasuryMemberId(balance.toMemberId)) {
    return treasuries.find((treasury) => getTreasuryMemberId(treasury.groupId) === balance.toMemberId)?.walletAddress ?? "";
  }

  return members.find((member) => member.id === balance.toMemberId)?.walletAddress ?? "";
}

function balancePairKey(groupId: string, fromMemberId: string, toMemberId: string) {
  return `${groupId}:${fromMemberId}:${toMemberId}`;
}

function normalizedPairKey(groupId: string, firstMemberId: string, secondMemberId: string) {
  const [first, second] = [firstMemberId, secondMemberId].sort();
  return `${groupId}:${first}:${second}`;
}
