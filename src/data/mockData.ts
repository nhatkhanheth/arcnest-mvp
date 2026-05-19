import type {
  Activity,
  ArcNestQRPayload,
  Balance,
  Expense,
  GlobalBalanceSummary,
  Group,
  GroupMember,
  MemberPermissions,
  MemberRole,
  Payment,
  Treasury,
  User,
  Wallet
} from "../models";

const now = Date.now();

export const permissionPresets: Record<MemberRole, MemberPermissions> = {
  owner: {
    canAddExpenses: true,
    canEditOwnExpenses: true,
    canEditAllExpenses: true,
    canDeleteExpenses: true,
    canViewAllBalances: true,
    canInviteMembers: true,
    canManageMembers: true,
    canManageTreasury: true,
    canWithdrawTreasury: true
  },
  admin: {
    canAddExpenses: true,
    canEditOwnExpenses: true,
    canEditAllExpenses: true,
    canDeleteExpenses: true,
    canViewAllBalances: true,
    canInviteMembers: true,
    canManageMembers: true,
    canManageTreasury: true,
    canWithdrawTreasury: false
  },
  editor: {
    canAddExpenses: true,
    canEditOwnExpenses: true,
    canEditAllExpenses: false,
    canDeleteExpenses: false,
    canViewAllBalances: false,
    canInviteMembers: false,
    canManageMembers: false,
    canManageTreasury: false,
    canWithdrawTreasury: false
  },
  member: {
    canAddExpenses: false,
    canEditOwnExpenses: false,
    canEditAllExpenses: false,
    canDeleteExpenses: false,
    canViewAllBalances: false,
    canInviteMembers: false,
    canManageMembers: false,
    canManageTreasury: false,
    canWithdrawTreasury: false
  }
};

export const currentUser: User = {
  id: "local_user",
  displayName: "ArcNest Tester",
  createdAt: now,
  updatedAt: now,
  lastSeenAt: now,
  settings: {
    theme: "arc-dark",
    soundEnabled: true,
    defaultCurrency: "VND"
  }
};

export const primaryWallet: Wallet = {
  id: "wallet_unconnected",
  userId: currentUser.id,
  address: "",
  type: "external",
  provider: "manual",
  chain: "arc",
  isPrimary: true,
  balanceUSDC: "0.00",
  balanceVND: 0,
  createdAt: now,
  updatedAt: now
};

export const groups: Group[] = [
  {
    id: "group_tennis",
    name: "C1K Tennis",
    type: "sports",
    ownerUserId: currentUser.id,
    defaultCurrency: "VND",
    settlementCurrency: "USDC",
    chain: "arc",
    treasuryEnabled: true,
    treasuryWalletAddress: "0xA771900F0E9cA519001C2E0BfcF4387260bA51C1",
    status: "active",
    createdAt: now - 1000 * 60 * 60 * 24 * 88,
    updatedAt: now - 1000 * 60 * 45
  },
  {
    id: "group_apartment",
    name: "Apartment 18B",
    type: "roommates",
    ownerUserId: "user_linh",
    defaultCurrency: "VND",
    settlementCurrency: "USDC",
    chain: "arc",
    treasuryEnabled: false,
    status: "active",
    createdAt: now - 1000 * 60 * 60 * 24 * 62,
    updatedAt: now - 1000 * 60 * 60 * 5
  },
  {
    id: "group_da_nang",
    name: "Da Nang Trip",
    type: "travel",
    ownerUserId: "user_mai",
    defaultCurrency: "VND",
    settlementCurrency: "USDC",
    chain: "arc",
    treasuryEnabled: true,
    treasuryWalletAddress: "0x79B3d50B926C0b4ed63Fc9445F24Ba6D29685981",
    status: "active",
    createdAt: now - 1000 * 60 * 60 * 24 * 24,
    updatedAt: now - 1000 * 60 * 60 * 2
  }
];

export const groupMembers: GroupMember[] = [
  {
    id: "member_minh_tennis",
    groupId: "group_tennis",
    userId: currentUser.id,
    displayName: "Minh",
    walletAddress: primaryWallet.address,
    role: "owner",
    permissions: permissionPresets.owner,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 88,
    createdAt: now - 1000 * 60 * 60 * 24 * 88,
    updatedAt: now
  },
  {
    id: "member_linh_tennis",
    groupId: "group_tennis",
    userId: "user_linh",
    displayName: "Linh",
    walletAddress: "0x4c7DfB4C958D188F957B37c75b8A41F636Ab3C91",
    role: "admin",
    permissions: permissionPresets.admin,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 77,
    createdAt: now - 1000 * 60 * 60 * 24 * 77,
    updatedAt: now
  },
  {
    id: "member_anh_tennis",
    groupId: "group_tennis",
    userId: "user_anh",
    displayName: "Anh",
    walletAddress: "0x5c779BD65dE2406e8f37139c7B01319139F08499",
    role: "editor",
    permissions: permissionPresets.editor,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 60,
    createdAt: now - 1000 * 60 * 60 * 24 * 60,
    updatedAt: now
  },
  {
    id: "member_khoa_tennis",
    groupId: "group_tennis",
    displayName: "Khoa",
    walletAddress: "0xE7fB5342Dc698E1b0636E801B891C08Cb1Aa9085",
    role: "member",
    permissions: permissionPresets.member,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 19,
    createdAt: now - 1000 * 60 * 60 * 24 * 19,
    updatedAt: now
  },
  {
    id: "member_minh_apartment",
    groupId: "group_apartment",
    userId: currentUser.id,
    displayName: "Minh",
    walletAddress: primaryWallet.address,
    role: "editor",
    permissions: permissionPresets.editor,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 62,
    createdAt: now - 1000 * 60 * 60 * 24 * 62,
    updatedAt: now
  },
  {
    id: "member_linh_apartment",
    groupId: "group_apartment",
    userId: "user_linh",
    displayName: "Linh",
    walletAddress: "0x4c7DfB4C958D188F957B37c75b8A41F636Ab3C91",
    role: "owner",
    permissions: permissionPresets.owner,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 62,
    createdAt: now - 1000 * 60 * 60 * 24 * 62,
    updatedAt: now
  },
  {
    id: "member_minh_trip",
    groupId: "group_da_nang",
    userId: currentUser.id,
    displayName: "Minh",
    walletAddress: primaryWallet.address,
    role: "admin",
    permissions: permissionPresets.admin,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 24,
    createdAt: now - 1000 * 60 * 60 * 24 * 24,
    updatedAt: now
  },
  {
    id: "member_mai_trip",
    groupId: "group_da_nang",
    userId: "user_mai",
    displayName: "Mai",
    walletAddress: "0x764E1e967B3e2159a103949D61d0C084e6236Dd2",
    role: "owner",
    permissions: permissionPresets.owner,
    status: "active",
    joinedAt: now - 1000 * 60 * 60 * 24 * 24,
    createdAt: now - 1000 * 60 * 60 * 24 * 24,
    updatedAt: now
  }
];

export const expenses: Expense[] = [
  {
    id: "expense_tennis_dinner",
    groupId: "group_tennis",
    title: "Dinner after tennis",
    amountVND: 980000,
    amountUSDC: "39.20",
    category: "Food",
    paidBy: "member_linh_tennis",
    participants: ["member_minh_tennis", "member_linh_tennis", "member_anh_tennis", "member_khoa_tennis"],
    splitMode: "equal",
    note: "Post-match dinner",
    createdBy: "user_linh",
    createdAt: now - 1000 * 60 * 60 * 18,
    updatedAt: now - 1000 * 60 * 60 * 18,
    status: "active"
  },
  {
    id: "expense_court",
    groupId: "group_tennis",
    title: "Court rental",
    amountVND: 600000,
    amountUSDC: "24.00",
    category: "Sports",
    paidBy: "member_minh_tennis",
    participants: ["member_minh_tennis", "member_linh_tennis", "member_anh_tennis", "member_khoa_tennis"],
    splitMode: "equal",
    createdBy: currentUser.id,
    createdAt: now - 1000 * 60 * 60 * 34,
    updatedAt: now - 1000 * 60 * 60 * 34,
    status: "active"
  },
  {
    id: "expense_wifi",
    groupId: "group_apartment",
    title: "Monthly internet",
    amountVND: 320000,
    amountUSDC: "12.80",
    category: "Bills",
    paidBy: "member_linh_apartment",
    participants: ["member_minh_apartment", "member_linh_apartment"],
    splitMode: "equal",
    createdBy: "user_linh",
    createdAt: now - 1000 * 60 * 60 * 26,
    updatedAt: now - 1000 * 60 * 60 * 26,
    status: "active"
  },
  {
    id: "expense_trip_van",
    groupId: "group_da_nang",
    title: "Airport van",
    amountVND: 1250000,
    amountUSDC: "50.00",
    category: "Travel",
    paidBy: "member_mai_trip",
    participants: ["member_minh_trip", "member_mai_trip"],
    splitMode: "fixed",
    createdBy: "user_mai",
    createdAt: now - 1000 * 60 * 60 * 48,
    updatedAt: now - 1000 * 60 * 60 * 48,
    status: "active"
  }
];

export const balances: Balance[] = [
  {
    id: "balance_owe_linh_dinner",
    groupId: "group_tennis",
    expenseId: "expense_tennis_dinner",
    fromMemberId: "member_minh_tennis",
    toMemberId: "member_linh_tennis",
    amountVND: 245000,
    amountUSDC: "9.80",
    status: "unpaid"
  },
  {
    id: "balance_receive_court_anh",
    groupId: "group_tennis",
    expenseId: "expense_court",
    fromMemberId: "member_anh_tennis",
    toMemberId: "member_minh_tennis",
    amountVND: 150000,
    amountUSDC: "6.00",
    status: "unpaid"
  },
  {
    id: "balance_receive_court_khoa",
    groupId: "group_tennis",
    expenseId: "expense_court",
    fromMemberId: "member_khoa_tennis",
    toMemberId: "member_minh_tennis",
    amountVND: 150000,
    amountUSDC: "6.00",
    status: "unpaid"
  },
  {
    id: "balance_owe_wifi",
    groupId: "group_apartment",
    expenseId: "expense_wifi",
    fromMemberId: "member_minh_apartment",
    toMemberId: "member_linh_apartment",
    amountVND: 160000,
    amountUSDC: "6.40",
    status: "unpaid"
  },
  {
    id: "balance_owe_trip_van",
    groupId: "group_da_nang",
    expenseId: "expense_trip_van",
    fromMemberId: "member_minh_trip",
    toMemberId: "member_mai_trip",
    amountVND: 625000,
    amountUSDC: "25.00",
    status: "unpaid"
  }
];

export const payments: Payment[] = [
  {
    id: "payment_court_paid",
    groupId: "group_tennis",
    expenseId: "expense_court",
    fromMemberId: "member_linh_tennis",
    toMemberId: "member_minh_tennis",
    fromWalletAddress: "0x4c7DfB4C958D188F957B37c75b8A41F636Ab3C91",
    toWalletAddress: primaryWallet.address,
    amountUSDC: "6.00",
    amountVND: 150000,
    chain: "arc",
    txHash: "0x4b5a39e1820ad7f62fce70569a71c2e77b1c3af7d001d20fd99c82a5a117182c",
    status: "paid",
    paymentType: "balance_payment",
    note: "Court rental",
    createdByUserId: "user_linh",
    createdAt: now - 1000 * 60 * 60 * 10,
    updatedAt: now - 1000 * 60 * 60 * 9,
    confirmedAt: now - 1000 * 60 * 60 * 9
  }
];

export const treasuries: Treasury[] = [
  {
    groupId: "group_tennis",
    enabled: true,
    walletAddress: "0xA771900F0E9cA519001C2E0BfcF4387260bA51C1",
    balanceUSDC: "72.30",
    balanceVND: 1807500,
    mode: "wallet",
    updatedAt: now - 1000 * 60 * 40
  },
  {
    groupId: "group_da_nang",
    enabled: true,
    walletAddress: "0x79B3d50B926C0b4ed63Fc9445F24Ba6D29685981",
    balanceUSDC: "118.00",
    balanceVND: 2950000,
    mode: "wallet",
    updatedAt: now - 1000 * 60 * 90
  }
];

export const activities: Activity[] = [
  {
    id: "activity_expense_created",
    groupId: "group_tennis",
    actorMemberId: "member_linh_tennis",
    type: "expense_created",
    targetId: "expense_tennis_dinner",
    metadata: {
      title: "Dinner after tennis",
      amountUSDC: "39.20"
    },
    createdAt: now - 1000 * 60 * 60 * 18
  },
  {
    id: "activity_payment_paid",
    groupId: "group_tennis",
    actorMemberId: "member_linh_tennis",
    type: "payment_paid",
    targetId: "payment_court_paid",
    metadata: {
      amountUSDC: "6.00",
      to: "Minh"
    },
    createdAt: now - 1000 * 60 * 60 * 9
  },
  {
    id: "activity_member_joined",
    groupId: "group_tennis",
    actorMemberId: "member_khoa_tennis",
    type: "member_joined",
    metadata: {
      memberName: "Khoa"
    },
    createdAt: now - 1000 * 60 * 60 * 24 * 19
  },
  {
    id: "activity_role_changed",
    groupId: "group_tennis",
    actorMemberId: "member_minh_tennis",
    type: "role_changed",
    metadata: {
      memberName: "Linh",
      role: "Admin"
    },
    createdAt: now - 1000 * 60 * 60 * 24 * 8
  },
  {
    id: "activity_invite_created",
    groupId: "group_da_nang",
    actorMemberId: "member_mai_trip",
    type: "invite_created",
    metadata: {
      inviteCode: "DN4-72QA"
    },
    createdAt: now - 1000 * 60 * 60 * 3
  }
];

export const globalSummary: GlobalBalanceSummary = {
  totalWalletUSDC: primaryWallet.balanceUSDC,
  totalOwesUSDC: "41.20",
  totalReceivesUSDC: "12.00",
  netUSDC: "-29.20",
  groups: [
    {
      groupId: "group_tennis",
      groupName: "C1K Tennis",
      owesUSDC: "9.80",
      receivesUSDC: "12.00",
      netUSDC: "2.20",
      paidPercent: 68
    },
    {
      groupId: "group_apartment",
      groupName: "Apartment 18B",
      owesUSDC: "6.40",
      receivesUSDC: "0.00",
      netUSDC: "-6.40",
      paidPercent: 42
    },
    {
      groupId: "group_da_nang",
      groupName: "Da Nang Trip",
      owesUSDC: "25.00",
      receivesUSDC: "0.00",
      netUSDC: "-25.00",
      paidPercent: 36
    }
  ]
};

export const qrPayloads: { payment: ArcNestQRPayload; invite: ArcNestQRPayload } = {
  payment: {
    type: "arcnest_payment",
    version: 1,
    network: "arc",
    receiverAddress: primaryWallet.address,
    amountUSDC: "12.50",
    groupId: "group_tennis",
    paymentId: "payment_preview",
    note: "C1K Tennis payment"
  },
  invite: {
    type: "arcnest_invite",
    version: 1,
    network: "arc",
    groupId: "group_tennis",
    inviteCode: "C1K-82KQ"
  }
};

export const soundSettings = [
  { id: "payment_success", label: "Payment success", enabled: true },
  { id: "save_success", label: "Save success", enabled: true },
  { id: "qr_scan", label: "QR scan", enabled: true },
  { id: "warning", label: "Warning", enabled: true }
];

export const fxRate = {
  usdcToVnd: 25000,
  label: "1 USDC = 25,000 VND"
};
