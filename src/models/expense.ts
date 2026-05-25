export type ExpenseCategory =
  | "Food"
  | "Travel"
  | "Bills"
  | "Sports"
  | "Shopping"
  | "Entertainment"
  | "Other";

export type SplitMode = "equal" | "fixed" | "custom" | "treasury";

export type Expense = {
  id: string;
  groupId: string;
  title: string;
  amountVND: number;
  amountUSDC: string;
  category: ExpenseCategory;
  paidBy: string;
  participants: string[];
  splitMode: SplitMode;
  splitAmountsVND?: Record<string, number>;
  note?: string;
  expenseDate?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  status: "active" | "edited" | "voided" | "deleted";
};

export type ExpenseShare = {
  memberId: string;
  displayName: string;
  amountVND: number;
  amountUSDC: string;
  direction: "owes" | "receives" | "treasury";
};

export type Balance = {
  id: string;
  groupId: string;
  expenseId?: string;
  fromMemberId: string;
  toMemberId: string;
  amountVND: number;
  amountUSDC: string;
  status: "unpaid" | "partially_paid" | "paid";
};
