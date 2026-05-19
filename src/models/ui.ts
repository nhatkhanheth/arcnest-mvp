export type PaymentRequest = {
  id: string;
  groupId?: string;
  groupName?: string;
  balanceId?: string;
  fromMemberId?: string;
  toMemberId?: string;
  toName: string;
  toWalletAddress: string;
  fromWalletAddress: string;
  amountUSDC: string;
  amountVND: number;
  note?: string;
};
