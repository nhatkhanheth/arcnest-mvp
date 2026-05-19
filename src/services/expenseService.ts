import type { Expense, ExpenseCategory, Group, GroupMember, SplitMode } from "../models";
import { collection, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import { getTreasuryMemberId, splitEvenly, toUSDC } from "./balanceService";
import { getFirestoreOrThrow, handleFirestoreError, sortByCreatedAt, stripUndefined, type FirestoreFailureHandler } from "./firestoreHelpers";

export type ExpenseDraft = {
  title: string;
  amountVND: number;
  category: ExpenseCategory;
  paidBy: string;
  participants: string[];
  splitMode: SplitMode;
  splitAmountsVND?: Record<string, number>;
  note?: string;
};

export type ExpenseValidationResult = {
  valid: boolean;
  message?: string;
};

export function validateExpenseDraft(group: Group, members: GroupMember[], draft: ExpenseDraft): ExpenseValidationResult {
  const activeMemberIds = new Set(members.filter((member) => member.status === "active").map((member) => member.id));
  const participants = draft.participants.filter((memberId) => activeMemberIds.has(memberId));

  if (!draft.title.trim()) {
    return { valid: false, message: "Add an expense title." };
  }

  if (draft.amountVND <= 0) {
    return { valid: false, message: "Amount must be greater than zero." };
  }

  if (participants.length === 0) {
    return { valid: false, message: "Select at least one participant." };
  }

  if (draft.splitMode !== "treasury" && !activeMemberIds.has(draft.paidBy)) {
    return { valid: false, message: "Choose who paid." };
  }

  if (draft.splitMode === "treasury" && !group.treasuryEnabled) {
    return { valid: false, message: "Treasury is off for this group." };
  }

  if (draft.splitMode === "custom") {
    const total = participants.reduce((sum, memberId) => sum + Math.round(Number(draft.splitAmountsVND?.[memberId] ?? 0)), 0);

    if (total !== draft.amountVND) {
      return { valid: false, message: `Custom shares must equal ${draft.amountVND.toLocaleString("vi-VN")} VND.` };
    }
  }

  return { valid: true };
}

export function normalizeSplitAmounts(draft: ExpenseDraft): Record<string, number> | undefined {
  if (draft.splitMode === "equal" || draft.splitMode === "treasury") {
    const shares = splitEvenly(draft.amountVND, draft.participants.length);
    return Object.fromEntries(draft.participants.map((memberId, index) => [memberId, shares[index] ?? 0]));
  }

  return Object.fromEntries(
    draft.participants.map((memberId) => [memberId, Math.max(0, Math.round(Number(draft.splitAmountsVND?.[memberId] ?? 0)))])
  );
}

export function createExpenseFromDraft(group: Group, draft: ExpenseDraft, currentUserId: string, now: number): Expense {
  return {
    id: makeExpenseId(draft.title, now),
    groupId: group.id,
    title: draft.title.trim(),
    amountVND: Math.round(draft.amountVND),
    amountUSDC: toUSDC(draft.amountVND),
    category: draft.category,
    paidBy: draft.splitMode === "treasury" ? getTreasuryMemberId(group.id) : draft.paidBy,
    participants: draft.participants,
    splitMode: draft.splitMode,
    splitAmountsVND: normalizeSplitAmounts(draft),
    note: draft.note?.trim() || undefined,
    createdBy: currentUserId,
    createdAt: now,
    updatedAt: now,
    status: "active"
  };
}

export function updateExpenseFromDraft(expense: Expense, group: Group, draft: ExpenseDraft, now: number): Expense {
  return {
    ...expense,
    title: draft.title.trim(),
    amountVND: Math.round(draft.amountVND),
    amountUSDC: toUSDC(draft.amountVND),
    category: draft.category,
    paidBy: draft.splitMode === "treasury" ? getTreasuryMemberId(group.id) : draft.paidBy,
    participants: draft.participants,
    splitMode: draft.splitMode,
    splitAmountsVND: normalizeSplitAmounts(draft),
    note: draft.note?.trim() || undefined,
    updatedAt: now,
    status: "edited"
  };
}

export function subscribeGroupExpenses(groupId: string, onExpenses: (expenses: Expense[]) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();
  const expensesQuery = query(collection(database, "groups", groupId, "expenses"), orderBy("createdAt", "desc"));

  return onSnapshot(
    expensesQuery,
    (snapshot) => {
      onExpenses(sortByCreatedAt(snapshot.docs.map((expenseSnapshot) => ({ id: expenseSnapshot.id, ...expenseSnapshot.data() }) as Expense)));
    },
    handleFirestoreError(onError)
  );
}

export async function persistExpense(expense: Expense) {
  const database = getFirestoreOrThrow();

  await setDoc(doc(database, "groups", expense.groupId, "expenses", expense.id), stripUndefined(expense), { merge: true });
}

export async function updateExpenseStatus(expense: Expense, status: Expense["status"], now = Date.now()) {
  await persistExpense({
    ...expense,
    status,
    updatedAt: now
  });
}

function makeExpenseId(title: string, now: number) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);

  return `expense_${slug || "item"}_${now.toString(36)}`;
}
