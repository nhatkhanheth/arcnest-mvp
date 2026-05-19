export type Treasury = {
  groupId: string;
  enabled: boolean;
  walletAddress?: string;
  balanceUSDC?: string;
  balanceVND?: number;
  mode: "offchain" | "wallet" | "vault_contract";
  updatedAt: number;
};

export type TreasuryTransaction = {
  id: string;
  groupId: string;
  type: "deposit" | "withdraw" | "payment" | "adjustment";
  fromMemberId?: string;
  toMemberId?: string;
  amountUSDC?: string;
  amountVND?: number;
  txHash?: string;
  status: "pending" | "confirmed" | "failed" | "manual";
  note?: string;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
};
