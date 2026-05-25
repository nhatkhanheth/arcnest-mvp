import { useSyncExternalStore } from "react";
import {
  activities as seedActivities,
  currentUser,
  expenses as seedExpenses,
  groupMembers as seedMembers,
  groups as seedGroups,
  payments as seedPayments,
  primaryWallet,
  treasuries as seedTreasuries
} from "../data/mockData";
import type {
  Activity,
  Expense,
  GlobalBalanceSummary,
  Group,
  GroupMember,
  MemberRole,
  Payment,
  PaymentRequest,
  Treasury,
  TreasuryTransaction,
  User,
  Wallet
} from "../models";
import { createActivity, persistActivity, sortActivities, subscribeGroupActivities } from "../services/activityService";
import { calculateGlobalBalanceSummary, calculateGroupBalances } from "../services/balanceService";
import type { ExpenseDraft } from "../services/expenseService";
import { createExpenseFromDraft, persistExpense, subscribeGroupExpenses, updateExpenseFromDraft, validateExpenseDraft } from "../services/expenseService";
import type { BalanceSnapshot, GroupDraft } from "../services/groupService";
import {
  canCreateExpense,
  canEditExpense,
  canInviteMembers,
  canManageMembers,
  canPayBalance,
  createGroupFromDraft,
  createMember,
  getCurrentMember,
  getGroupById,
  persistAccountMembership,
  persistBalanceSnapshot,
  persistGroup,
  persistGroupBundle,
  persistMember,
  roleOptionsForActor,
  restoreMemberAccessForAuth,
  softRemoveMember as softRemoveMemberRemote,
  subscribeBalanceSnapshot,
  subscribeGroup,
  subscribeGroupMembers,
  subscribeUserMemberships,
  updateGroupFromDraft,
  updateGroupTimestamp,
  updateMemberRole
} from "../services/groupService";
import {
  getInviteByCode,
  getInviteResolvedStatus,
  isValidInviteCode,
  normalizeInviteCode,
  persistInvite,
  recordInviteUsed,
  type InviteRecord
} from "../services/inviteService";
import {
  createPendingMockPayment,
  executeUSDCPayment,
  getPaymentErrorMessage,
  checkPaymentReceiptStatus,
  lockPaymentForAttempt,
  markPaymentCancelled,
  markPaymentFailure,
  markPaymentFailed as markPaymentFailedModel,
  markPaymentPaid as markPaymentPaidModel,
  markPaymentPending as markPaymentPendingModel,
  persistPayment,
  retryPayment as retryMockPayment,
  subscribeGroupPayments,
  validatePaymentRequest
} from "../services/paymentService";
import { subscribeTreasuryTransactions } from "../services/treasuryService";
import { markUserSeededFromLocal, setUserActiveGroup, type FirebaseUserProfile } from "../services/userService";

const storageKey = "arcnest-local-state-v4";
const devDemoWalletAddress = "0x8F12aB4431c8E91C35B8F1d2A990d8e5b03d9D77";

type ArcNestState = {
  version: 4;
  currentUser: User;
  wallet: Wallet;
  activeGroupId: string;
  groups: Group[];
  members: GroupMember[];
  expenses: Expense[];
  payments: Payment[];
  treasuries: Treasury[];
  treasuryTransactions: TreasuryTransaction[];
  activities: Activity[];
  balanceSnapshots: Record<string, BalanceSnapshot>;
  inviteCodes: Record<string, string>;
};

type ActionResult = {
  ok: boolean;
  message?: string;
  groupId?: string;
  expenseId?: string;
  memberId?: string;
  paymentId?: string;
  inviteCode?: string;
};

type StoreSnapshot = ArcNestState & {
  balances: ReturnType<typeof calculateGroupBalances>;
  globalSummary: GlobalBalanceSummary;
  firebaseSync: SyncStatus;
};

type SyncStatus = {
  mode: "local" | "firebase";
  loading: boolean;
  error?: string;
};

const initialState: ArcNestState = {
  version: 4,
  currentUser,
  wallet: primaryWallet,
  activeGroupId: "",
  groups: [],
  members: [],
  expenses: [],
  payments: [],
  treasuries: [],
  treasuryTransactions: [],
  activities: [],
  balanceSnapshots: {},
  inviteCodes: {}
};

let state = loadState();
const listeners = new Set<() => void>();
let cachedState = state;
let cachedSnapshot: StoreSnapshot | undefined;
let syncStatus: SyncStatus = {
  mode: "local",
  loading: false
};
let remoteUserId: string | undefined;
let remoteAuthUserId: string | undefined;
let membershipsUnsubscribe: (() => void) | undefined;
const groupUnsubscribes = new Map<string, Array<() => void>>();
const seededUsers = new Set<string>();
const pendingPaymentReceiptChecks = new Set<string>();

export function useGroupStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...snapshot,
    ...actions
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): StoreSnapshot {
  if (cachedSnapshot && cachedState === state) {
    return cachedSnapshot;
  }

  const balances = calculateGroupBalances(state.expenses, state.payments, state.members);
  const globalSummary = calculateGlobalBalanceSummary(
    state.groups,
    balances,
    state.expenses,
    state.payments,
    state.members,
    state.currentUser.id,
    state.wallet.balanceUSDC
  );

  cachedState = state;
  cachedSnapshot = {
    ...state,
    balances,
    globalSummary,
    firebaseSync: syncStatus
  };

  return cachedSnapshot;
}

function setState(updater: (current: ArcNestState) => ArcNestState) {
  state = updater(state);
  persistState(state);
  listeners.forEach((listener) => listener());
}

function loadState(): ArcNestState {
  if (typeof window === "undefined") {
    return initialState;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return initialState;
    }

    const parsed = JSON.parse(raw) as Partial<Omit<ArcNestState, "version">> & { version?: number };

    if (parsed.version !== 4) {
      return initialState;
    }

    return {
      ...initialState,
      ...parsed,
      version: 4,
      treasuryTransactions: parsed.treasuryTransactions ?? [],
      balanceSnapshots: parsed.balanceSnapshots ?? {},
      currentUser,
      wallet: primaryWallet
    };
  } catch {
    return initialState;
  }
}

function persistState(nextState: ArcNestState) {
  if (typeof window === "undefined") {
    return;
  }

  if (syncStatus.mode === "firebase" || nextState.currentUser.id.startsWith("wallet_") || nextState.currentUser.authUserId) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(nextState));
}

export function connectGroupStoreToFirebase(profile?: FirebaseUserProfile) {
  if (!profile) {
    return;
  }

  const accountUserId = getProfileAccountUserId(profile);
  migrateToFirebaseUser(profile, accountUserId);

  if (remoteUserId === accountUserId && remoteAuthUserId === profile.id && membershipsUnsubscribe) {
    if (profile.activeGroupId && state.groups.some((group) => group.id === profile.activeGroupId)) {
      setState((current) => ({ ...current, activeGroupId: profile.activeGroupId ?? current.activeGroupId }));
    }
    setSyncStatus({ mode: "firebase", loading: false, error: syncStatus.error });
    return;
  }

  setSyncStatus({ mode: "firebase", loading: true, error: undefined });
  membershipsUnsubscribe?.();
  clearGroupSubscriptions();
  remoteUserId = accountUserId;
  remoteAuthUserId = profile.id;

  membershipsUnsubscribe = subscribeUserMemberships(
    accountUserId,
    profile.id,
    profile.primaryWalletAddress,
    (memberships) => {
      const activeMemberships = memberships.filter((member) => member.status === "active" || member.status === "invited");
      const groupIds = Array.from(new Set(activeMemberships.map((member) => member.groupId)));

      if (groupIds.length === 0 && !profile.seededFromLocalAt && !seededUsers.has(profile.id)) {
        if (shouldSeedLocalStateToFirebase()) {
          seededUsers.add(profile.id);
          void seedCurrentStateToFirestore(profile.id).catch(setRemoteError);
          return;
        }

        clearFirebaseScopedState();
        setSyncStatus({ mode: "firebase", loading: false, error: undefined });
        return;
      }

      void restoreAuthAccessThenSubscribe(activeMemberships, profile.id, groupIds).catch(setRemoteError);
    },
    setRemoteError
  );
}

export function resetGroupStoreSession() {
  membershipsUnsubscribe?.();
  membershipsUnsubscribe = undefined;
  clearGroupSubscriptions();
  remoteUserId = undefined;
  remoteAuthUserId = undefined;
  setSyncStatus({ mode: "local", loading: false, error: undefined });
  setState(() => initialState);

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey);
  }
}

async function restoreAuthAccessThenSubscribe(memberships: GroupMember[], authUserId: string, groupIds: string[]) {
  await Promise.all(
    memberships.map(async (member) => {
      await persistAccountMembership(member);
      await restoreMemberAccessForAuth(member, authUserId).catch(() => undefined);
    })
  );
  syncGroupSubscriptions(groupIds);
  setSyncStatus({ mode: "firebase", loading: false, error: undefined });
}

function migrateToFirebaseUser(profile: FirebaseUserProfile, accountUserId: string) {
  setState((current) => {
    const previousUserId = current.currentUser.id;
    const primaryWalletAddress = profile.primaryWalletAddress ?? current.currentUser.primaryWalletAddress;
    const nextUser: User = {
      ...current.currentUser,
      ...profile,
      id: accountUserId,
      authUserId: profile.id,
      primaryWalletAddress,
      settings: {
        ...current.currentUser.settings,
        ...profile.settings
      }
    };

    if (previousUserId === accountUserId) {
      return {
        ...current,
        currentUser: nextUser,
        wallet: {
          ...current.wallet,
          userId: accountUserId,
          address: nextUser.primaryWalletAddress ?? current.wallet.address
        },
        activeGroupId: profile.activeGroupId && current.groups.some((group) => group.id === profile.activeGroupId) ? profile.activeGroupId : current.activeGroupId
      };
    }

    return {
      ...current,
      currentUser: nextUser,
      wallet: {
        ...current.wallet,
        userId: accountUserId,
        address: nextUser.primaryWalletAddress ?? current.wallet.address
      },
      activeGroupId: "",
      groups: [],
      members: [],
      expenses: [],
      payments: [],
      treasuries: [],
      treasuryTransactions: [],
      activities: [],
      balanceSnapshots: {},
      inviteCodes: {}
    };
  });
}

function syncGroupSubscriptions(groupIds: string[]) {
  const nextGroupIds = new Set(groupIds);

  for (const [groupId, unsubscribes] of groupUnsubscribes.entries()) {
    if (!nextGroupIds.has(groupId)) {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
      groupUnsubscribes.delete(groupId);
      removeGroupScopedRemoteData(groupId);
    }
  }

  pruneUnsubscribedGroupData(nextGroupIds);

  for (const groupId of nextGroupIds) {
    if (groupUnsubscribes.has(groupId)) {
      continue;
    }

    groupUnsubscribes.set(groupId, [
      subscribeGroup(groupId, (group) => mergeRemoteGroup(groupId, group), setRemoteError),
      subscribeGroupMembers(groupId, (members) => replaceGroupScoped("members", groupId, members), setRemoteError),
      subscribeGroupExpenses(groupId, (expenses) => replaceGroupScoped("expenses", groupId, expenses), setRemoteError),
      subscribeGroupPayments(groupId, (payments) => replaceGroupScoped("payments", groupId, payments), setRemoteError),
      subscribeGroupActivities(groupId, (activities) => replaceGroupScoped("activities", groupId, activities), setRemoteError),
      subscribeBalanceSnapshot(groupId, (snapshot) => mergeBalanceSnapshot(groupId, snapshot), setRemoteError),
      subscribeTreasuryTransactions(groupId, (transactions) => replaceGroupScoped("treasuryTransactions", groupId, transactions), setRemoteError)
    ]);
  }
}

function clearGroupSubscriptions() {
  groupUnsubscribes.forEach((unsubscribes) => unsubscribes.forEach((unsubscribe) => unsubscribe()));
  groupUnsubscribes.clear();
}

function mergeRemoteGroup(groupId: string, group?: Group) {
  if (!group) {
    return;
  }

  setState((current) => ({
    ...current,
    groups: upsertById(current.groups, group),
    activeGroupId: current.activeGroupId || groupId
  }));
}

function replaceGroupScoped<Key extends "members" | "expenses" | "payments" | "activities" | "treasuryTransactions">(
  key: Key,
  groupId: string,
  items: ArcNestState[Key]
) {
  if (key === "activities") {
    setState((current) => ({
      ...current,
      activities: sortActivities([
        ...current.activities.filter((activity) => activity.groupId !== groupId),
        ...(items as Activity[])
      ])
    }));
    return;
  }

  if (key === "payments") {
    const payments = items as Payment[];

    setState((current) => ({
      ...current,
      payments: [
        ...current.payments.filter((payment) => payment.groupId !== groupId),
        ...payments
      ]
    }));
    resumePendingPaymentConfirmations(payments);
    return;
  }

  setState((current) => ({
    ...current,
    [key]: [
      ...(current[key] as Array<{ groupId: string }>).filter((item) => item.groupId !== groupId),
      ...(items as Array<{ groupId: string }>)
    ]
  }));
}

function mergeBalanceSnapshot(groupId: string, snapshot?: BalanceSnapshot) {
  if (!snapshot) {
    return;
  }

  setState((current) => ({
    ...current,
    balanceSnapshots: {
      ...current.balanceSnapshots,
      [groupId]: snapshot
    },
    treasuries: snapshot.treasury ? upsertTreasury(current.treasuries, snapshot.treasury) : current.treasuries
  }));
}

function removeGroupScopedRemoteData(groupId: string) {
  setState((current) => ({
    ...current,
    groups: current.groups.filter((group) => group.id !== groupId),
    members: current.members.filter((member) => member.groupId !== groupId),
    expenses: current.expenses.filter((expense) => expense.groupId !== groupId),
    payments: current.payments.filter((payment) => payment.groupId !== groupId),
    treasuryTransactions: current.treasuryTransactions.filter((transaction) => transaction.groupId !== groupId),
    activities: current.activities.filter((activity) => activity.groupId !== groupId),
    treasuries: current.treasuries.filter((treasury) => treasury.groupId !== groupId)
  }));
}

function pruneUnsubscribedGroupData(groupIds: Set<string>) {
  setState((current) => ({
    ...current,
    activeGroupId: groupIds.has(current.activeGroupId) ? current.activeGroupId : Array.from(groupIds)[0] ?? "",
    groups: current.groups.filter((group) => groupIds.has(group.id)),
    members: current.members.filter((member) => groupIds.has(member.groupId)),
    expenses: current.expenses.filter((expense) => groupIds.has(expense.groupId)),
    payments: current.payments.filter((payment) => groupIds.has(payment.groupId) || isLocalOnlyGroupId(payment.groupId)),
    treasuryTransactions: current.treasuryTransactions.filter((transaction) => groupIds.has(transaction.groupId)),
    activities: current.activities.filter((activity) => groupIds.has(activity.groupId) || isLocalOnlyGroupId(activity.groupId)),
    treasuries: current.treasuries.filter((treasury) => groupIds.has(treasury.groupId)),
    balanceSnapshots: Object.fromEntries(Object.entries(current.balanceSnapshots).filter(([groupId]) => groupIds.has(groupId))),
    inviteCodes: Object.fromEntries(Object.entries(current.inviteCodes).filter(([, groupId]) => groupIds.has(groupId)))
  }));
}

function clearFirebaseScopedState() {
  clearGroupSubscriptions();
  setState((current) => ({
    ...current,
    activeGroupId: "",
    groups: [],
    members: [],
    expenses: [],
    payments: [],
    treasuries: [],
    treasuryTransactions: [],
    activities: [],
    balanceSnapshots: {},
    inviteCodes: {}
  }));
}

function shouldSeedLocalStateToFirebase() {
  return false;
}

async function seedCurrentStateToFirestore(userId: string) {
  const snapshot = getSnapshot();

  await Promise.all([
    ...snapshot.groups.map((group) => persistGroup(group)),
    ...snapshot.members.map((member) => persistMember(member)),
    ...snapshot.expenses.map((expense) => persistExpense(expense)),
    ...snapshot.payments.map((payment) => persistPayment(payment)),
    ...snapshot.activities.map((activity) => persistActivity(activity)),
    ...Object.entries(snapshot.inviteCodes).map(([code, groupId]) =>
      persistInvite({
        id: code,
        code,
        groupId,
        groupName: snapshot.groups.find((group) => group.id === groupId)?.name,
        groupType: snapshot.groups.find((group) => group.id === groupId)?.type,
        createdByUserId: snapshot.groups.find((group) => group.id === groupId)?.ownerUserId,
        createdByAuthUserId: snapshot.groups.find((group) => group.id === groupId)?.ownerAuthUserId,
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    ),
    ...snapshot.groups.map((group) =>
      persistBalanceSnapshot(
        group.id,
        snapshot.balances.filter((balance) => balance.groupId === group.id),
        snapshot.treasuries.find((treasury) => treasury.groupId === group.id)
      )
    )
  ]);

  await markUserSeededFromLocal(userId);
  setSyncStatus({ mode: "firebase", loading: false, error: undefined });
}

function syncRemoteBalanceSnapshot(groupId: string) {
  if (!remoteUserId || !state.groups.some((group) => group.id === groupId)) {
    return;
  }

  const snapshot = getSnapshot();
  void persistBalanceSnapshot(
    groupId,
    snapshot.balances.filter((balance) => balance.groupId === groupId),
    state.treasuries.find((treasury) => treasury.groupId === groupId)
  ).catch(setRemoteError);
}

function runRemote(task: () => Promise<unknown>) {
  if (!remoteUserId && !state.currentUser.authUserId) {
    return;
  }

  void task().catch(setRemoteError);
}

function runRemoteWithAuth(task: () => Promise<unknown>) {
  if (!remoteUserId && !state.currentUser.authUserId) {
    return;
  }

  void task().catch(setRemoteError);
}

function runRemoteForGroup(groupId: string, task: () => Promise<unknown>) {
  if (!remoteUserId || !state.groups.some((group) => group.id === groupId)) {
    return;
  }

  void task().catch(setRemoteError);
}

async function finalizePaidPayment(payment: Payment, txHash: string, mode: "mock" | "testnet"): Promise<ActionResult> {
  const now = Date.now();
  const latestPayment = state.payments.find((item) => item.id === payment.id) ?? payment;
  const paidPayment = markPaymentPaidModel(latestPayment, now, txHash);
  const activity = createPaymentLifecycleActivity(paidPayment, "payment_paid", now, {
    amountUSDC: paidPayment.amountUSDC,
    txHash: paidPayment.txHash,
    mode
  });

  setState((current) => ({
    ...current,
    payments: upsertById(current.payments, paidPayment),
    activities: sortActivities(upsertById(current.activities, activity))
  }));

  if (remoteUserId) {
    try {
      await persistPayment(paidPayment);
      await persistActivity(activity);
      syncRemoteBalanceSnapshot(paidPayment.groupId);
    } catch (error) {
      setRemoteError(error);
    }
  }

  return {
    ok: true,
    paymentId: paidPayment.id,
    message: mode === "mock" ? "Demo payment completed." : "Testnet payment confirmed."
  };
}

function upsertPaymentState(payment: Payment) {
  setState((current) => ({
    ...current,
    payments: upsertById(current.payments, payment)
  }));
}

function createPaymentLifecycleActivity(payment: Payment, type: Extract<Activity["type"], "payment_started" | "payment_paid" | "payment_failed">, now: number, metadata: Record<string, unknown>) {
  return {
    ...createActivity(
      {
        groupId: payment.groupId,
        actorUserId: state.currentUser.id,
        actorMemberId: payment.fromMemberId,
        type,
        targetId: payment.id,
        metadata
      },
      now
    ),
    id: `activity_${type}_${payment.id}`
  };
}

function resumePendingPaymentConfirmations(payments: Payment[]) {
  for (const payment of payments) {
    if (payment.status !== "pending" || !payment.txHash || pendingPaymentReceiptChecks.has(payment.id)) {
      continue;
    }

    pendingPaymentReceiptChecks.add(payment.id);
    void checkPaymentReceiptStatus(payment)
      .then(async (receiptStatus) => {
        if (receiptStatus === "success" && payment.txHash) {
          await finalizePaidPayment(payment, payment.txHash, "testnet");
          return;
        }

        if (receiptStatus === "reverted") {
          const now = Date.now();
          const failedPayment = markPaymentFailure(payment, now, "Payment failed.");
          const activity = createPaymentLifecycleActivity(failedPayment, "payment_failed", now, {
            amountUSDC: failedPayment.amountUSDC,
            reason: "Payment failed."
          });

          setState((current) => ({
            ...current,
            payments: upsertById(current.payments, failedPayment),
            activities: sortActivities(upsertById(current.activities, activity))
          }));

          if (remoteUserId) {
            await persistPayment(failedPayment);
            await persistActivity(activity);
            syncRemoteBalanceSnapshot(failedPayment.groupId);
          }
        }
      })
      .catch(setRemoteError)
      .finally(() => {
        pendingPaymentReceiptChecks.delete(payment.id);
      });
  }
}

function getExistingPaymentMessage(status: Payment["status"]) {
  if (status === "paid") {
    return "This payment was already paid.";
  }

  if (status === "pending") {
    return "This payment is already being processed.";
  }

  if (status === "failed") {
    return "Retry available.";
  }

  if (status === "cancelled") {
    return "This payment was cancelled.";
  }

  return undefined;
}

function setRemoteActiveGroup(groupId: string) {
  const authUserId = remoteAuthUserId ?? state.currentUser.authUserId;

  if (!authUserId) {
    return Promise.resolve();
  }

  return setUserActiveGroup(authUserId, groupId);
}

function setRemoteError(error: unknown) {
  setSyncStatus({
    mode: "firebase",
    loading: false,
    error: error instanceof Error ? error.message : String(error)
  });
}

function setSyncStatus(nextStatus: SyncStatus) {
  syncStatus = nextStatus;
  cachedSnapshot = undefined;
  listeners.forEach((listener) => listener());
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return items.some((current) => current.id === item.id) ? items.map((current) => (current.id === item.id ? item : current)) : [item, ...items];
}

function upsertTreasury(items: Treasury[], treasury: Treasury) {
  return items.some((current) => current.groupId === treasury.groupId)
    ? items.map((current) => (current.groupId === treasury.groupId ? treasury : current))
    : [treasury, ...items];
}

function findInviteCodeForGroup(inviteCodes: Record<string, string>, groupId: string) {
  return Object.entries(inviteCodes).find(([, inviteGroupId]) => inviteGroupId === groupId)?.[0];
}

function makeInviteCodeForGroup(groupName: string, now: number) {
  const prefix = groupName
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "A");

  return `${prefix}-${now.toString(36).slice(-4).toUpperCase()}`;
}

function getProfileAccountUserId(profile: FirebaseUserProfile) {
  return profile.primaryWalletAddress ? getWalletAccountUserId(profile.primaryWalletAddress) : profile.id;
}

function getWalletAccountUserId(address: string) {
  return `wallet_${address.trim().toLowerCase().replace(/^0x/, "")}`;
}

function getInviteGroupPlaceholder(invite: InviteRecord, now = Date.now()): Group {
  return {
    id: invite.groupId,
    name: invite.groupName ?? "Invited group",
    type: invite.groupType ?? "other",
    ownerUserId: invite.createdByUserId ?? "",
    ownerAuthUserId: invite.createdByAuthUserId,
    defaultCurrency: "VND",
    settlementCurrency: "USDC",
    chain: "arc",
    treasuryEnabled: false,
    status: "active",
    createdAt: invite.createdAt ?? now,
    updatedAt: invite.updatedAt ?? now
  };
}

async function getInviteByCodeWithRetry(inviteCode: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const invite = await getInviteByCode(inviteCode);

    if (invite || attempt === 4) {
      return invite;
    }

    await wait(700);
  }

  return undefined;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isLocalOnlyGroupId(groupId?: string) {
  return !groupId || groupId === "group_external" || groupId.startsWith("direct_");
}

function createC1KDemoSeed(current: ArcNestState, now: number): Pick<
  ArcNestState,
  "activeGroupId" | "groups" | "members" | "expenses" | "payments" | "treasuries" | "activities" | "inviteCodes"
> {
  const groupId = "group_tennis";
  const demoGroup = seedGroups.find((group) => group.id === groupId);
  const minhMemberId = "member_minh_tennis";
  const linhMemberId = "member_linh_tennis";
  const demoMembers = seedMembers.filter((member) => member.groupId === groupId);
  const demoExpenses = seedExpenses.filter((expense) => expense.groupId === groupId);
  const demoTreasuries = seedTreasuries.filter((treasury) => treasury.groupId === groupId);
  const paidPayment = seedPayments.find((payment) => payment.id === "payment_court_paid");
  const minhMember = demoMembers.find((member) => member.id === minhMemberId);
  const linhMember = demoMembers.find((member) => member.id === linhMemberId);
  const demoWalletAddress = current.wallet.address || current.currentUser.primaryWalletAddress || devDemoWalletAddress;

  if (!demoGroup || !minhMember || !linhMember?.walletAddress || !paidPayment) {
    return {
      activeGroupId: current.activeGroupId,
      groups: current.groups,
      members: current.members,
      expenses: current.expenses,
      payments: current.payments,
      treasuries: current.treasuries,
      activities: current.activities,
      inviteCodes: current.inviteCodes
    };
  }

  const groups: Group[] = [
    {
      ...demoGroup,
      ownerUserId: current.currentUser.id,
      ownerAuthUserId: current.currentUser.authUserId,
      updatedAt: now
    }
  ];
  const members: GroupMember[] = demoMembers.map((member) =>
    member.id === minhMemberId
      ? {
          ...member,
          userId: current.currentUser.id,
          authUserId: current.currentUser.authUserId,
          walletAddress: demoWalletAddress,
          updatedAt: now
        }
      : {
          ...member,
          updatedAt: now
        }
  );
  const expenses: Expense[] = demoExpenses.map((expense, index) => ({
    ...expense,
    createdBy: expense.createdBy === currentUser.id ? current.currentUser.id : expense.createdBy,
    createdAt: now - 1000 * 60 * 60 * (index + 2),
    updatedAt: now - 1000 * 60 * 60 * (index + 2)
  }));
  const payments: Payment[] = [
    {
      id: "payment_demo_pending",
      groupId,
      balanceId: "balance_group_tennis_member_minh_tennis_member_linh_tennis",
      fromMemberId: minhMemberId,
      toMemberId: linhMemberId,
      fromWalletAddress: demoWalletAddress,
      toWalletAddress: linhMember.walletAddress,
      amountUSDC: "9.80",
      amountVND: 245000,
      chain: "arc",
      status: "pending",
      paymentType: "balance_payment",
      note: "Dinner after tennis",
      createdByUserId: current.currentUser.id,
      createdAt: now - 1000 * 60 * 20,
      updatedAt: now - 1000 * 60 * 20
    },
    {
      ...paidPayment,
      toWalletAddress: demoWalletAddress,
      createdAt: now - 1000 * 60 * 60,
      updatedAt: now - 1000 * 60 * 45,
      confirmedAt: now - 1000 * 60 * 45
    }
  ];
  const activities: Activity[] = [
    createActivity(
      {
        groupId,
        actorUserId: current.currentUser.id,
        actorMemberId: minhMemberId,
        type: "invite_created",
        targetId: "C1K-82KQ",
        metadata: {
          inviteCode: "C1K-82KQ"
        }
      },
      now - 1000 * 60 * 5
    ),
    createActivity(
      {
        groupId,
        actorUserId: current.currentUser.id,
        actorMemberId: minhMemberId,
        type: "payment_started",
        targetId: "payment_demo_pending",
        metadata: {
          amountUSDC: "9.80",
          to: "Linh"
        }
      },
      now - 1000 * 60 * 20
    ),
    ...seedActivities
      .filter((activity) => activity.groupId === groupId)
      .map((activity, index) => ({
        ...activity,
        actorUserId: activity.actorUserId === currentUser.id ? current.currentUser.id : activity.actorUserId,
        createdAt: now - 1000 * 60 * 60 * (index + 1)
      }))
  ];

  return {
    activeGroupId: groupId,
    groups,
    members,
    expenses,
    payments,
    treasuries: demoTreasuries,
    activities: sortActivities(activities),
    inviteCodes: {
      "C1K-82KQ": groupId
    }
  };
}

function setGroupStatus(
  groupId: string,
  status: Group["status"],
  activityType: Extract<Activity["type"], "group_archived" | "group_deleted">,
  message: string
): ActionResult {
  const group = state.groups.find((item) => item.id === groupId);
  const actor = getCurrentMember(state.members, groupId, state.currentUser.id);

  if (!group) {
    return { ok: false, message: "Group not found." };
  }

  if (!canManageMembers(actor)) {
    return { ok: false, message: "Your role cannot manage this group." };
  }

  const now = Date.now();
  const updatedGroup: Group = {
    ...group,
    status,
    updatedAt: now
  };
  const activity = createActivity(
    {
      groupId,
      actorUserId: state.currentUser.id,
      actorMemberId: actor?.id,
      type: activityType,
      targetId: groupId,
      metadata: {
        groupName: group.name
      }
    },
    now
  );

  setState((current) => {
    const activeGroups = current.groups.filter((item) => item.id !== groupId && item.status === "active");

    return {
      ...current,
      activeGroupId: current.activeGroupId === groupId ? activeGroups[0]?.id ?? "" : current.activeGroupId,
      groups: current.groups.map((item) => (item.id === groupId ? updatedGroup : item)),
      activities: sortActivities([activity, ...current.activities])
    };
  });

  runRemoteForGroup(groupId, async () => {
    await persistGroup(updatedGroup);
    await persistActivity(activity);
  });

  return { ok: true, groupId, message };
}

function setExpenseStatus(
  expenseId: string,
  status: Extract<Expense["status"], "voided" | "deleted">,
  activityType: Extract<Activity["type"], "expense_voided" | "expense_deleted">,
  message: string
): ActionResult {
  const expense = state.expenses.find((item) => item.id === expenseId);

  if (!expense) {
    return { ok: false, message: "Expense not found." };
  }

  const group = state.groups.find((item) => item.id === expense.groupId);
  const actor = getCurrentMember(state.members, expense.groupId, state.currentUser.id);

  if (!group) {
    return { ok: false, message: "Group not found." };
  }

  if (!actor?.permissions.canDeleteExpenses && !canManageMembers(actor)) {
    return { ok: false, message: "Your role cannot remove this expense." };
  }

  const now = Date.now();
  const updatedExpense: Expense = {
    ...expense,
    status,
    updatedAt: now
  };
  const updatedGroup = updateGroupTimestamp(group, now);
  const activity = createActivity(
    {
      groupId: expense.groupId,
      actorMemberId: actor?.id,
      actorUserId: state.currentUser.id,
      type: activityType,
      targetId: expense.id,
      metadata: {
        title: expense.title,
        amountUSDC: expense.amountUSDC
      }
    },
    now
  );

  setState((current) => ({
    ...current,
    expenses: current.expenses.map((item) => (item.id === expenseId ? updatedExpense : item)),
    groups: current.groups.map((item) => (item.id === expense.groupId ? updatedGroup : item)),
    activities: sortActivities([activity, ...current.activities])
  }));

  runRemoteForGroup(expense.groupId, async () => {
    await persistExpense(updatedExpense);
    await persistActivity(activity);
    await persistGroup(updatedGroup);
    syncRemoteBalanceSnapshot(expense.groupId);
  });

  return { ok: true, expenseId, message };
}

const actions = {
  seedDemoData(): ActionResult {
    if (!import.meta.env.DEV) {
      return { ok: false, message: "Demo seed is only available in development." };
    }

    const now = Date.now();
    const demo = createC1KDemoSeed(state, now);

    setState((current) => ({
      ...current,
      activeGroupId: demo.activeGroupId,
      groups: demo.groups,
      members: demo.members,
      expenses: demo.expenses,
      payments: demo.payments,
      treasuries: demo.treasuries,
      treasuryTransactions: [],
      activities: demo.activities,
      balanceSnapshots: {},
      inviteCodes: demo.inviteCodes
    }));

    runRemote(async () => {
      await Promise.all([
        ...demo.groups.map((group) => persistGroup(group)),
        ...demo.members.map((member) => persistMember(member)),
        ...demo.expenses.map((expense) => persistExpense(expense)),
        ...demo.payments.map((payment) => persistPayment(payment)),
        ...demo.activities.map((activity) => persistActivity(activity)),
        ...Object.entries(demo.inviteCodes).map(([code, groupId]) =>
          persistInvite({
            id: code,
            code,
            groupId,
            groupName: demo.groups.find((group) => group.id === groupId)?.name,
            groupType: demo.groups.find((group) => group.id === groupId)?.type,
            createdByUserId: state.currentUser.id,
            createdByAuthUserId: state.currentUser.authUserId,
            status: "active",
            createdAt: now,
            updatedAt: now
          })
        ),
        ...demo.groups.map((group) =>
          persistBalanceSnapshot(
            group.id,
            getSnapshot().balances.filter((balance) => balance.groupId === group.id),
            demo.treasuries.find((treasury) => treasury.groupId === group.id)
          )
        )
      ]);
      await setRemoteActiveGroup(demo.activeGroupId);
      if (remoteAuthUserId) {
        await markUserSeededFromLocal(remoteAuthUserId);
      }
    });

    return { ok: true, groupId: demo.activeGroupId };
  },

  switchActiveGroup(groupId: string): ActionResult {
    if (!state.groups.some((group) => group.id === groupId && group.status === "active")) {
      return { ok: false, message: "Group not found." };
    }

    setState((current) => ({ ...current, activeGroupId: groupId }));
    runRemote(() => setRemoteActiveGroup(groupId));
    return { ok: true, groupId };
  },

  setPrimaryWalletAddress(address: string): ActionResult {
    const normalizedAddress = address.trim();

    if (!normalizedAddress) {
      return { ok: false, message: "Wallet address is empty." };
    }

    const accountUserId = getWalletAccountUserId(normalizedAddress);

    setState((current) => ({
      ...current,
      currentUser: {
        ...current.currentUser,
        id: accountUserId,
        authUserId: remoteAuthUserId ?? current.currentUser.authUserId,
        primaryWalletAddress: normalizedAddress,
        updatedAt: Date.now()
      },
      wallet: {
        ...current.wallet,
        userId: accountUserId,
        address: normalizedAddress,
        updatedAt: Date.now()
      },
      ...(current.currentUser.id === accountUserId
        ? {}
        : {
            activeGroupId: "",
            groups: [],
            members: [],
            expenses: [],
            payments: [],
            treasuries: [],
            treasuryTransactions: [],
            activities: [],
            balanceSnapshots: {},
            inviteCodes: {}
          })
    }));

    return { ok: true };
  },

  setWalletBalance(balance: { balanceUSDC: string; balanceVND: number }): ActionResult {
    setState((current) => ({
      ...current,
      wallet: {
        ...current.wallet,
        balanceUSDC: balance.balanceUSDC,
        balanceVND: balance.balanceVND,
        updatedAt: Date.now()
      }
    }));

    return { ok: true };
  },

  createGroup(draft: GroupDraft): ActionResult {
    const now = Date.now();
    const created = createGroupFromDraft(draft, state.currentUser, now);
    const activity = createActivity(
      {
        groupId: created.group.id,
        actorUserId: state.currentUser.id,
        actorMemberId: created.ownerMember.id,
        type: "group_created",
        targetId: created.group.id,
        metadata: {
          groupName: created.group.name
        }
      },
      now
    );
    const inviteActivity = createActivity(
      {
        groupId: created.group.id,
        actorUserId: state.currentUser.id,
        actorMemberId: created.ownerMember.id,
        type: "invite_created",
        targetId: created.inviteCode,
        metadata: {
          inviteCode: created.inviteCode
        }
      },
      now + 1
    );

    setState((current) => ({
      ...current,
      activeGroupId: created.group.id,
      groups: [created.group, ...current.groups],
      members: [created.ownerMember, ...current.members],
      treasuries: created.treasury ? [created.treasury, ...current.treasuries] : current.treasuries,
      activities: sortActivities([inviteActivity, activity, ...current.activities]),
      inviteCodes: {
        ...current.inviteCodes,
        [created.inviteCode]: created.group.id
      }
    }));

    runRemote(async () => {
      await persistGroupBundle({
        group: created.group,
        ownerMember: created.ownerMember,
        treasury: created.treasury,
        inviteCode: created.inviteCode,
        activities: [activity, inviteActivity]
      });
      await setRemoteActiveGroup(created.group.id);
    });

    return { ok: true, groupId: created.group.id, inviteCode: created.inviteCode };
  },

  editGroup(groupId: string, draft: GroupDraft): ActionResult {
    const group = state.groups.find((item) => item.id === groupId);
    const actor = getCurrentMember(state.members, groupId, state.currentUser.id);

    if (!group) {
      return { ok: false, message: "Group not found." };
    }

    if (!canManageMembers(actor)) {
      return { ok: false, message: "Your role cannot edit this group." };
    }

    if (!draft.name.trim()) {
      return { ok: false, message: "Add a group name." };
    }

    const now = Date.now();
    const updatedGroup = updateGroupFromDraft(group, draft, now);
    const existingTreasury = state.treasuries.find((treasury) => treasury.groupId === groupId);
    const updatedTreasury: Treasury | undefined = existingTreasury
      ? { ...existingTreasury, enabled: draft.treasuryEnabled, updatedAt: now }
      : draft.treasuryEnabled
        ? {
            groupId,
            enabled: true,
            balanceUSDC: "0.00",
            balanceVND: 0,
            mode: "offchain",
            updatedAt: now
          }
        : undefined;
    const activity = createActivity(
      {
        groupId,
        actorUserId: state.currentUser.id,
        actorMemberId: actor?.id,
        type: "group_edited",
        targetId: groupId,
        metadata: {
          groupName: updatedGroup.name
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      groups: current.groups.map((item) => (item.id === groupId ? updatedGroup : item)),
      treasuries: updatedTreasury
        ? upsertTreasury(current.treasuries, updatedTreasury)
        : current.treasuries,
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemoteForGroup(groupId, async () => {
      await persistGroup(updatedGroup);
      await persistActivity(activity);
      syncRemoteBalanceSnapshot(groupId);
    });

    return { ok: true, groupId };
  },

  archiveGroup(groupId: string): ActionResult {
    return setGroupStatus(groupId, "archived", "group_archived", "Group archived.");
  },

  deleteGroup(groupId: string): ActionResult {
    return setGroupStatus(groupId, "deleted", "group_deleted", "Group deleted.");
  },

  ensureInviteForGroup(groupId: string): ActionResult {
    const group = state.groups.find((item) => item.id === groupId && item.status === "active");

    if (!group) {
      return { ok: false, message: "Group not found." };
    }

    const actor = getCurrentMember(state.members, group.id, state.currentUser.id);

    if (!canInviteMembers(actor)) {
      return { ok: false, message: "Your role cannot invite members." };
    }

    const existingInviteCode = findInviteCodeForGroup(state.inviteCodes, group.id);

    if (existingInviteCode) {
      const now = Date.now();

      runRemote(() =>
        persistInvite({
          id: existingInviteCode,
          code: existingInviteCode,
          groupId: group.id,
          groupName: group.name,
          groupType: group.type,
          createdByUserId: group.ownerUserId,
          createdByAuthUserId: group.ownerAuthUserId,
          status: "active",
          createdAt: group.createdAt,
          updatedAt: now
        })
      );

      return { ok: true, groupId: group.id, inviteCode: existingInviteCode };
    }

    const now = Date.now();
    const inviteCode = makeInviteCodeForGroup(group.name, now);
    const activity = createActivity(
      {
        groupId: group.id,
        actorUserId: state.currentUser.id,
        actorMemberId: actor?.id,
        type: "invite_created",
        targetId: inviteCode,
        metadata: {
          inviteCode
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      inviteCodes: {
        ...current.inviteCodes,
        [inviteCode]: group.id
      },
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemote(async () => {
      await persistInvite({
        id: inviteCode,
        code: inviteCode,
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        createdByUserId: state.currentUser.id,
        createdByAuthUserId: state.currentUser.authUserId,
        status: "active",
        createdAt: now,
        updatedAt: now
      });
      await persistActivity(activity);
    });

    return { ok: true, groupId: group.id, inviteCode };
  },

  async joinGroupByInviteCode(code: string, nickname?: string): Promise<ActionResult> {
    const inviteCode = normalizeInviteCode(code);
    const displayName = nickname?.trim();

    if (!isValidInviteCode(inviteCode)) {
      return { ok: false, message: "Invite code should look like C1K-82KQ." };
    }

    if (!displayName) {
      return { ok: false, message: "Add a nickname before joining." };
    }

    let invite: InviteRecord | undefined;
    let groupId = state.inviteCodes[inviteCode];
    let group = state.groups.find((item) => item.id === groupId && item.status === "active");

    try {
      invite = await getInviteByCodeWithRetry(inviteCode);
    } catch {
      if (!group) {
        return { ok: false, message: "Invite sync is not ready. Reconnect your wallet and try again." };
      }
    }

    if (invite) {
      const inviteStatus = getInviteResolvedStatus(invite);

      if (inviteStatus === "expired") {
        const expiredInvite: InviteRecord = { ...invite, status: "expired", updatedAt: Date.now() };
        runRemote(() => persistInvite(expiredInvite));
        return { ok: false, message: "Invite expired" };
      }

      if (inviteStatus === "revoked") {
        return { ok: false, message: "Invite revoked." };
      }

      groupId = invite.groupId;
      group = state.groups.find((item) => item.id === groupId && item.status === "active");

      if (!group) {
        try {
          group = (await getGroupById(invite.groupId)) ?? getInviteGroupPlaceholder(invite);
        } catch {
          group = getInviteGroupPlaceholder(invite);
        }
      }
    }

    if (!group) {
      return { ok: false, message: "Invite code was not found." };
    }

    const existingMember = getCurrentMember(state.members, group.id, state.currentUser.id);

    if (existingMember) {
      setState((current) => ({ ...current, activeGroupId: group.id }));
      return { ok: true, groupId: group.id, memberId: existingMember.id, message: "You are already in this group." };
    }

    const now = Date.now();
    const member: GroupMember = {
      ...createMember({
        groupId: group.id,
        userId: state.currentUser.id,
        authUserId: state.currentUser.authUserId,
        displayName,
        walletAddress: state.wallet.address,
        role: "member",
        now
      }),
      inviteCode
    };
    const activity = createActivity(
      {
        groupId: group.id,
        actorUserId: state.currentUser.id,
        actorMemberId: member.id,
        type: "member_joined",
        targetId: member.id,
        metadata: {
          memberName: member.displayName
        }
      },
      now
    );
    const inviteActivity = createActivity(
      {
        groupId: group.id,
        actorUserId: state.currentUser.id,
        actorMemberId: member.id,
        type: "invite_used",
        targetId: inviteCode,
        metadata: {
          inviteCode,
          memberName: member.displayName
        }
      },
      now + 1
    );
    const inviteRecord: InviteRecord =
      invite ?? {
        id: inviteCode,
        code: inviteCode,
        groupId: group.id,
        groupName: group.name,
        groupType: group.type,
        createdByUserId: group.ownerUserId,
        createdByAuthUserId: group.ownerAuthUserId,
        status: "active",
        createdAt: now,
        updatedAt: now
      };

    setState((current) => ({
      ...current,
      activeGroupId: group.id,
      members: [member, ...current.members],
      groups: upsertById(current.groups, group),
      inviteCodes: {
        ...current.inviteCodes,
        [inviteCode]: group.id
      },
      activities: sortActivities([inviteActivity, activity, ...current.activities])
    }));

    runRemoteWithAuth(async () => {
      await persistMember(member);
      await persistActivity(activity);
      await persistActivity(inviteActivity);
      await recordInviteUsed(inviteRecord, state.currentUser.id, now);
      await setRemoteActiveGroup(group.id);
    });

    return { ok: true, groupId: group.id, memberId: member.id };
  },

  addMember(groupId: string, input: { displayName: string; walletAddress?: string; role: MemberRole }): ActionResult {
    const actor = getCurrentMember(state.members, groupId, state.currentUser.id);

    if (!canManageMembers(actor)) {
      return { ok: false, message: "Your role cannot manage members." };
    }

    if (!roleOptionsForActor(actor).includes(input.role)) {
      return { ok: false, message: "Your role cannot assign that role." };
    }

    const now = Date.now();
    const member = createMember({
      groupId,
      displayName: input.displayName,
      walletAddress: input.walletAddress,
      role: input.role,
      now
    });
    const activity = createActivity(
      {
        groupId,
        actorMemberId: actor?.id,
        actorUserId: state.currentUser.id,
        type: "member_joined",
        targetId: member.id,
        metadata: {
          memberName: member.displayName
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      members: [member, ...current.members],
      groups: current.groups.map((group) => (group.id === groupId ? updateGroupTimestamp(group, now) : group)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemote(async () => {
      await persistMember(member);
      await persistActivity(activity);
      const group = state.groups.find((item) => item.id === groupId);
      if (group) {
        await persistGroup(updateGroupTimestamp(group, now));
      }
    });

    return { ok: true, memberId: member.id };
  },

  changeMemberRole(groupId: string, memberId: string, role: MemberRole): ActionResult {
    const actor = getCurrentMember(state.members, groupId, state.currentUser.id);
    const target = state.members.find((member) => member.id === memberId && member.groupId === groupId);

    if (!target) {
      return { ok: false, message: "Member not found." };
    }

    if (!canManageMembers(actor)) {
      return { ok: false, message: "Your role cannot manage members." };
    }

    if (target.id === actor?.id) {
      return { ok: false, message: "You cannot change your own role in this MVP flow." };
    }

    if (target.role === "owner" && actor?.role !== "owner") {
      return { ok: false, message: "Only the owner can change owner roles." };
    }

    if (!roleOptionsForActor(actor).includes(role)) {
      return { ok: false, message: "Your role cannot assign that role." };
    }

    const now = Date.now();
    const updatedTarget = updateMemberRole(target, role, now);
    const activity = createActivity(
      {
        groupId,
        actorMemberId: actor?.id,
        actorUserId: state.currentUser.id,
        type: "role_changed",
        targetId: memberId,
        metadata: {
          memberName: target.displayName,
          role
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      members: current.members.map((member) => (member.id === memberId ? updatedTarget : member)),
      groups: current.groups.map((group) => (group.id === groupId ? updateGroupTimestamp(group, now) : group)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemote(async () => {
      await persistMember(updatedTarget);
      await persistActivity(activity);
      const group = state.groups.find((item) => item.id === groupId);
      if (group) {
        await persistGroup(updateGroupTimestamp(group, now));
      }
    });

    return { ok: true, memberId };
  },

  removeMember(groupId: string, memberId: string): ActionResult {
    const actor = getCurrentMember(state.members, groupId, state.currentUser.id);
    const target = state.members.find((member) => member.id === memberId && member.groupId === groupId);

    if (!target) {
      return { ok: false, message: "Member not found." };
    }

    if (!canManageMembers(actor)) {
      return { ok: false, message: "Your role cannot remove members." };
    }

    if (target.role === "owner") {
      return { ok: false, message: "Owner members cannot be removed in this MVP." };
    }

    const now = Date.now();
    const removedTarget: GroupMember = {
      ...target,
      status: "removed",
      removedAt: now,
      updatedAt: now
    };
    const activity = createActivity(
      {
        groupId,
        actorMemberId: actor?.id,
        actorUserId: state.currentUser.id,
        type: "member_removed",
        targetId: memberId,
        metadata: {
          memberName: target.displayName
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      members: current.members.map((member) => (member.id === memberId ? removedTarget : member)),
      groups: current.groups.map((group) => (group.id === groupId ? updateGroupTimestamp(group, now) : group)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemote(async () => {
      await softRemoveMemberRemote(target, now);
      await persistActivity(activity);
      const group = state.groups.find((item) => item.id === groupId);
      if (group) {
        await persistGroup(updateGroupTimestamp(group, now));
      }
    });

    return { ok: true, memberId };
  },

  createExpense(groupId: string, draft: ExpenseDraft): ActionResult {
    const group = state.groups.find((item) => item.id === groupId);
    const actor = getCurrentMember(state.members, groupId, state.currentUser.id);
    const members = state.members.filter((member) => member.groupId === groupId);

    if (!group) {
      return { ok: false, message: "Group not found." };
    }

    if (!canCreateExpense(actor)) {
      return { ok: false, message: "Your role cannot add expenses." };
    }

    const validation = validateExpenseDraft(group, members, draft);

    if (!validation.valid) {
      return { ok: false, message: validation.message };
    }

    const now = Date.now();
    const expense = createExpenseFromDraft(group, draft, state.currentUser.id, now);
    const activity = createActivity(
      {
        groupId,
        actorMemberId: actor?.id,
        actorUserId: state.currentUser.id,
        type: "expense_created",
        targetId: expense.id,
        metadata: {
          title: expense.title,
          amountUSDC: expense.amountUSDC
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      expenses: [expense, ...current.expenses],
      groups: current.groups.map((item) => (item.id === groupId ? updateGroupTimestamp(item, now) : item)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemote(async () => {
      await persistExpense(expense);
      await persistActivity(activity);
      await persistGroup(updateGroupTimestamp(group, now));
      syncRemoteBalanceSnapshot(groupId);
    });

    return { ok: true, expenseId: expense.id };
  },

  editExpense(expenseId: string, draft: ExpenseDraft): ActionResult {
    const expense = state.expenses.find((item) => item.id === expenseId);

    if (!expense) {
      return { ok: false, message: "Expense not found." };
    }

    const group = state.groups.find((item) => item.id === expense.groupId);
    const actor = getCurrentMember(state.members, expense.groupId, state.currentUser.id);
    const members = state.members.filter((member) => member.groupId === expense.groupId);

    if (!group) {
      return { ok: false, message: "Group not found." };
    }

    if (!canEditExpense(actor, expense.createdBy, state.currentUser.id)) {
      return { ok: false, message: "Your role cannot edit this expense." };
    }

    const validation = validateExpenseDraft(group, members, draft);

    if (!validation.valid) {
      return { ok: false, message: validation.message };
    }

    const now = Date.now();
    const updatedExpense = updateExpenseFromDraft(expense, group, draft, now);
    const activity = createActivity(
      {
        groupId: expense.groupId,
        actorMemberId: actor?.id,
        actorUserId: state.currentUser.id,
        type: "expense_edited",
        targetId: expense.id,
        metadata: {
          title: updatedExpense.title,
          amountUSDC: updatedExpense.amountUSDC
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      expenses: current.expenses.map((item) => (item.id === expenseId ? updatedExpense : item)),
      groups: current.groups.map((item) => (item.id === expense.groupId ? updateGroupTimestamp(item, now) : item)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemote(async () => {
      await persistExpense(updatedExpense);
      await persistActivity(activity);
      await persistGroup(updateGroupTimestamp(group, now));
      syncRemoteBalanceSnapshot(expense.groupId);
    });

    return { ok: true, expenseId };
  },

  voidExpense(expenseId: string): ActionResult {
    return setExpenseStatus(expenseId, "voided", "expense_voided", "Expense voided.");
  },

  deleteExpense(expenseId: string): ActionResult {
    return setExpenseStatus(expenseId, "deleted", "expense_deleted", "Expense deleted.");
  },

  startPayment(request: PaymentRequest): ActionResult {
    const groupId = request.groupId || state.activeGroupId;
    const actor = getCurrentMember(state.members, groupId, state.currentUser.id);

    if (request.fromMemberId && actor && request.fromMemberId !== actor.id) {
      return { ok: false, message: "You can only pay your own balance." };
    }

    if (actor && !canPayBalance(actor)) {
      return { ok: false, message: "Your role cannot pay from this group." };
    }

    const validation = validatePaymentRequest(request);

    if (!validation.valid) {
      return { ok: false, message: validation.message };
    }

    const requestRecordId = request.balanceId ?? request.id;
    const existing = state.payments.find(
      (payment) =>
        payment.id === request.id ||
        (payment.balanceId === requestRecordId &&
          payment.groupId === groupId &&
          payment.fromMemberId === (request.fromMemberId ?? actor?.id))
    );

    if (existing) {
      return {
        ok: true,
        paymentId: existing.id,
        message: getExistingPaymentMessage(existing.status)
      };
    }

    const now = Date.now();
    const payment = createPendingMockPayment({
      request: {
        ...request,
        groupId: groupId || undefined
      },
      currentUserId: state.currentUser.id,
      members: state.members,
      now
    });
    const activity = createActivity(
      {
        groupId: payment.groupId,
        actorMemberId: actor?.id,
        actorUserId: state.currentUser.id,
        type: "payment_started",
        targetId: payment.id,
        metadata: {
          amountUSDC: payment.amountUSDC,
          to: request.toName
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      payments: [payment, ...current.payments],
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemoteForGroup(payment.groupId, async () => {
      await persistPayment(payment);
      await persistActivity(activity);
      syncRemoteBalanceSnapshot(payment.groupId);
    });

    return { ok: true, paymentId: payment.id };
  },

  markPaymentPaid(paymentId: string): ActionResult {
    const payment = state.payments.find((item) => item.id === paymentId);

    if (!payment) {
      return { ok: false, message: "Payment not found." };
    }

    const now = Date.now();
    const paidPayment = markPaymentPaidModel(payment, now);
    const activity = createActivity(
      {
        groupId: payment.groupId,
        actorUserId: state.currentUser.id,
        actorMemberId: payment.fromMemberId,
        type: "payment_paid",
        targetId: payment.id,
        metadata: {
          amountUSDC: payment.amountUSDC,
          txHash: paidPayment.txHash
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      payments: current.payments.map((item) => (item.id === paymentId ? paidPayment : item)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemoteForGroup(payment.groupId, async () => {
      await persistPayment(paidPayment);
      await persistActivity(activity);
      syncRemoteBalanceSnapshot(payment.groupId);
    });

    return { ok: true, paymentId };
  },

  async completePayment(paymentId: string): Promise<ActionResult> {
    const payment = state.payments.find((item) => item.id === paymentId);

    if (!payment) {
      return { ok: false, message: "Payment not found." };
    }

    if (payment.status === "paid") {
      return { ok: true, paymentId, message: "This payment was already paid." };
    }

    if (payment.status === "pending") {
      return { ok: false, paymentId, message: "This payment is already being processed." };
    }

    if (payment.status === "cancelled") {
      return { ok: false, paymentId, message: "This payment was cancelled and cannot be paid." };
    }

    if (payment.status === "failed" && payment.txHash) {
      const receiptStatus = await checkPaymentReceiptStatus(payment);

      if (receiptStatus === "success") {
        return finalizePaidPayment(payment, payment.txHash, "testnet");
      }

      if (receiptStatus === "not_found") {
        const pendingAt = Date.now();
        const pendingPayment = markPaymentPendingModel(payment, pendingAt);
        upsertPaymentState(pendingPayment);
        runRemoteForGroup(payment.groupId, () => persistPayment(pendingPayment));
        return { ok: false, paymentId, message: "Transaction submitted. Waiting for confirmation." };
      }
    }

    try {
      const pendingAt = Date.now();
      let lockedPayment = markPaymentPendingModel(payment, pendingAt);

      if (remoteUserId) {
        const lock = await lockPaymentForAttempt(payment, payment.fromWalletAddress);

        if (!lock.ok) {
          if (lock.payment) {
            upsertPaymentState(lock.payment);
          }

          return { ok: false, paymentId, message: lock.message };
        }

        lockedPayment = lock.payment;
      } else {
        upsertPaymentState(lockedPayment);
      }

      const pendingActivity = createPaymentLifecycleActivity(lockedPayment, "payment_started", pendingAt, {
        amountUSDC: lockedPayment.amountUSDC,
        status: "pending"
      });

      setState((current) => ({
        ...current,
        payments: upsertById(current.payments, lockedPayment),
        activities: sortActivities(upsertById(current.activities, pendingActivity))
      }));

      if (remoteUserId) {
        await persistActivity(pendingActivity);
      }

      const result = await executeUSDCPayment(lockedPayment, {
        async onSubmitted(txHash) {
          const submittedAt = Date.now();
          const latestPayment = state.payments.find((item) => item.id === paymentId) ?? lockedPayment;
          const submittedPayment = {
            ...markPaymentPendingModel(latestPayment, submittedAt, txHash),
            attemptId: lockedPayment.attemptId,
            lockedAt: lockedPayment.lockedAt,
            lockedByWalletAddress: lockedPayment.lockedByWalletAddress
          };

          upsertPaymentState(submittedPayment);

          if (remoteUserId) {
            try {
              await persistPayment(submittedPayment);
            } catch (error) {
              setRemoteError(error);
            }
          }
        }
      });

      return finalizePaidPayment(state.payments.find((item) => item.id === paymentId) ?? lockedPayment, result.txHash, result.mode);
    } catch (error) {
      const now = Date.now();
      const latestPayment = state.payments.find((item) => item.id === paymentId) ?? payment;
      const failedPayment = markPaymentFailedModel(latestPayment, now);
      const message = getPaymentErrorMessage(error);

      if (latestPayment.txHash) {
        const receiptStatus = await checkPaymentReceiptStatus(latestPayment);

        if (receiptStatus === "success") {
          return finalizePaidPayment(latestPayment, latestPayment.txHash, "testnet");
        }

        if (receiptStatus === "not_found") {
          const stillPending = markPaymentPendingModel(latestPayment, now);
          upsertPaymentState(stillPending);

          if (remoteUserId) {
            try {
              await persistPayment(stillPending);
            } catch (remoteError) {
              setRemoteError(remoteError);
            }
          }

          return { ok: false, paymentId, message: "Transaction submitted. Waiting for confirmation." };
        }
      }

      const failedWithReason = markPaymentFailure(failedPayment, now, message);
      const activity = createPaymentLifecycleActivity(failedWithReason, "payment_failed", now, {
        amountUSDC: failedWithReason.amountUSDC,
        reason: message
      });

      setState((current) => ({
        ...current,
        payments: upsertById(current.payments, failedWithReason),
        activities: sortActivities(upsertById(current.activities, activity))
      }));

      if (remoteUserId) {
        try {
          await persistPayment(failedWithReason);
          await persistActivity(activity);
          syncRemoteBalanceSnapshot(payment.groupId);
        } catch (remoteError) {
          setRemoteError(remoteError);
        }
      }

      return { ok: false, paymentId, message };
    }
  },

  markPaymentFailed(paymentId: string): ActionResult {
    const payment = state.payments.find((item) => item.id === paymentId);

    if (!payment) {
      return { ok: false, message: "Payment not found." };
    }

    const now = Date.now();
    const failedPayment = markPaymentFailedModel(payment, now);
    const activity = createActivity(
      {
        groupId: payment.groupId,
        actorUserId: state.currentUser.id,
        actorMemberId: payment.fromMemberId,
        type: "payment_failed",
        targetId: payment.id,
        metadata: {
          amountUSDC: payment.amountUSDC
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      payments: current.payments.map((item) => (item.id === paymentId ? failedPayment : item)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemoteForGroup(payment.groupId, async () => {
      await persistPayment(failedPayment);
      await persistActivity(activity);
      syncRemoteBalanceSnapshot(payment.groupId);
    });

    return { ok: true, paymentId };
  },

  retryPayment(paymentId: string): ActionResult {
    const payment = state.payments.find((item) => item.id === paymentId);

    if (!payment) {
      return { ok: false, message: "Payment not found." };
    }

    if (payment.status !== "failed") {
      return { ok: false, paymentId, message: getExistingPaymentMessage(payment.status) ?? "This payment cannot be retried." };
    }

    if (payment.txHash) {
      const now = Date.now();
      const pendingPayment = markPaymentPendingModel(payment, now);

      upsertPaymentState(pendingPayment);
      runRemoteForGroup(payment.groupId, () => persistPayment(pendingPayment));

      return { ok: false, paymentId, message: "Transaction submitted. Waiting for confirmation." };
    }

    const now = Date.now();
    const pendingPayment = retryMockPayment(payment, now);
    const activity = createActivity(
      {
        groupId: payment.groupId,
        actorUserId: state.currentUser.id,
        actorMemberId: payment.fromMemberId,
        type: "payment_started",
        targetId: payment.id,
        metadata: {
          amountUSDC: payment.amountUSDC,
          retry: true
        }
      },
      now
    );

    setState((current) => ({
      ...current,
      payments: current.payments.map((item) => (item.id === paymentId ? pendingPayment : item)),
      activities: sortActivities([activity, ...current.activities])
    }));

    runRemoteForGroup(payment.groupId, async () => {
      await persistPayment(pendingPayment);
      await persistActivity(activity);
      syncRemoteBalanceSnapshot(payment.groupId);
    });

    return { ok: true, paymentId };
  },

  cancelPayment(paymentId: string): ActionResult {
    const payment = state.payments.find((item) => item.id === paymentId);

    if (!payment) {
      return { ok: false, message: "Payment not found." };
    }

    if (payment.createdByUserId !== state.currentUser.id) {
      const actor = getCurrentMember(state.members, payment.groupId, state.currentUser.id);

      if (!actor || actor.role !== "owner") {
        return { ok: false, message: "Only the payer or owner can cancel this payment." };
      }
    }

    const now = Date.now();
    const cancelledPayment = markPaymentCancelled(payment, now);

    setState((current) => ({
      ...current,
      payments: current.payments.map((item) => (item.id === paymentId ? cancelledPayment : item))
    }));

    runRemoteForGroup(payment.groupId, async () => {
      await persistPayment(cancelledPayment);
      syncRemoteBalanceSnapshot(payment.groupId);
    });

    return { ok: true, paymentId };
  }
};

export const groupStore = {
  getState: getSnapshot,
  actions
};
