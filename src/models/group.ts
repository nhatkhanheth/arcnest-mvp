export type GroupType =
  | "family"
  | "friends"
  | "sports"
  | "travel"
  | "work"
  | "roommates"
  | "community"
  | "other";

export type MemberRole = "owner" | "admin" | "editor" | "member";

export type MemberPermissions = {
  canAddExpenses: boolean;
  canEditOwnExpenses: boolean;
  canEditAllExpenses: boolean;
  canDeleteExpenses: boolean;
  canViewAllBalances: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canManageTreasury: boolean;
  canWithdrawTreasury: boolean;
};

export type Group = {
  id: string;
  name: string;
  type: GroupType;
  ownerUserId: string;
  defaultCurrency: "VND" | "USD";
  settlementCurrency: "USDC";
  chain: "arc";
  treasuryEnabled: boolean;
  treasuryWalletAddress?: string;
  status: "active" | "archived" | "deleted";
  createdAt: number;
  updatedAt: number;
};

export type GroupMember = {
  id: string;
  groupId: string;
  userId?: string;
  displayName: string;
  walletAddress?: string;
  role: MemberRole;
  permissions: MemberPermissions;
  status: "active" | "invited" | "removed" | "left";
  joinedAt?: number;
  invitedAt?: number;
  removedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type GroupBalanceSummary = {
  groupId: string;
  groupName: string;
  owesUSDC: string;
  receivesUSDC: string;
  netUSDC: string;
  paidPercent: number;
};

export type GlobalBalanceSummary = {
  totalWalletUSDC: string;
  totalOwesUSDC: string;
  totalReceivesUSDC: string;
  netUSDC: string;
  groups: GroupBalanceSummary[];
};
