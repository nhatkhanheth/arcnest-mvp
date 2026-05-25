export type Payment = {
  id: string;
  groupId: string;
  expenseId?: string;
  balanceId?: string;
  fromMemberId: string;
  toMemberId: string;
  fromWalletAddress: string;
  toWalletAddress: string;
  amountUSDC: string;
  amountVND?: number;
  chain: "arc";
  txHash?: string;
  status: "unpaid" | "pending" | "paid" | "failed" | "cancelled";
  paymentType:
    | "balance_payment"
    | "qr_payment"
    | "treasury_deposit"
    | "treasury_payment"
    | "manual_record";
  note?: string;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
  lockedAt?: number;
  lockedByWalletAddress?: string;
  attemptId?: string;
  submittedAt?: number;
  confirmedAt?: number;
  failedAt?: number;
  failureReason?: string;
};

export type PaymentSheetState = "confirm" | "success" | "insufficient";
