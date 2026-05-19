import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  writeBatch
} from "firebase/firestore";
import type { Activity, Balance, Group, GroupMember, GroupType, MemberPermissions, MemberRole, Treasury, User } from "../models";
import { permissionPresets } from "../data/mockData";
import {
  getFirestoreOrThrow,
  handleFirestoreError,
  noopUnsubscribe,
  sortByCreatedAt,
  stripUndefined,
  type FirestoreFailureHandler
} from "./firestoreHelpers";

export type GroupDraft = {
  name: string;
  type: GroupType;
  treasuryEnabled: boolean;
  defaultCurrency?: "VND" | "USD";
};

export type BalanceSnapshot = {
  id: "current";
  groupId: string;
  balances: Balance[];
  treasury?: Treasury;
  updatedAt: number;
};

export function createGroupFromDraft(draft: GroupDraft, currentUser: User, now: number): { group: Group; ownerMember: GroupMember; treasury?: Treasury; inviteCode: string } {
  const id = makeGroupId(draft.name, now);

  return {
    group: {
      id,
      name: draft.name.trim(),
      type: draft.type,
      ownerUserId: currentUser.id,
      defaultCurrency: draft.defaultCurrency ?? "VND",
      settlementCurrency: "USDC",
      chain: "arc",
      treasuryEnabled: draft.treasuryEnabled,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    ownerMember: createMember({
      groupId: id,
      userId: currentUser.id,
      displayName: currentUser.displayName.split(" ")[0] ?? currentUser.displayName,
      walletAddress: currentUser.primaryWalletAddress,
      role: "owner",
      now
    }),
    treasury: draft.treasuryEnabled
      ? {
          groupId: id,
          enabled: true,
          walletAddress: undefined,
          balanceUSDC: "0.00",
          balanceVND: 0,
          mode: "offchain",
          updatedAt: now
        }
      : undefined,
    inviteCode: makeInviteCode(draft.name, now)
  };
}

export function createMember({
  groupId,
  userId,
  displayName,
  walletAddress,
  role,
  now
}: {
  groupId: string;
  userId?: string;
  displayName: string;
  walletAddress?: string;
  role: MemberRole;
  now: number;
}): GroupMember {
  return {
    id: makeMemberId(groupId, displayName, now),
    groupId,
    userId,
    displayName: displayName.trim() || "Member",
    walletAddress,
    role,
    permissions: permissionPresets[role],
    status: "active",
    joinedAt: now,
    createdAt: now,
    updatedAt: now
  };
}

export function getCurrentMember(members: GroupMember[], groupId: string, userId: string) {
  return members.find((member) => member.groupId === groupId && member.userId === userId && member.status === "active");
}

export function canCreateExpense(member?: GroupMember) {
  return Boolean(member?.permissions.canAddExpenses);
}

export function canEditExpense(member: GroupMember | undefined, createdByUserId: string, currentUserId: string) {
  if (!member) {
    return false;
  }

  return member.permissions.canEditAllExpenses || (member.permissions.canEditOwnExpenses && createdByUserId === currentUserId);
}

export function canPayBalance(member?: GroupMember) {
  return Boolean(member && member.status === "active");
}

export function canManageMembers(member?: GroupMember) {
  return Boolean(member?.permissions.canManageMembers);
}

export function canInviteMembers(member?: GroupMember) {
  return Boolean(member?.permissions.canInviteMembers);
}

export function roleOptionsForActor(actor?: GroupMember): MemberRole[] {
  if (!actor) {
    return [];
  }

  if (actor.role === "owner") {
    return ["owner", "admin", "editor", "member"];
  }

  if (actor.role === "admin") {
    return ["admin", "editor", "member"];
  }

  return [];
}

export function updateMemberRole(member: GroupMember, role: MemberRole, now: number): GroupMember {
  return {
    ...member,
    role,
    permissions: permissionPresets[role],
    updatedAt: now
  };
}

export function updateGroupTimestamp(group: Group, now: number): Group {
  return {
    ...group,
    updatedAt: now
  };
}

export function subscribeActiveGroupId(userId: string, onActiveGroupId: (activeGroupId?: string) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();

  return onSnapshot(
    doc(database, "users", userId),
    (snapshot) => {
      onActiveGroupId(snapshot.exists() ? (snapshot.data().activeGroupId as string | undefined) : undefined);
    },
    handleFirestoreError(onError)
  );
}

export function subscribeUserMemberships(userId: string, onMemberships: (memberships: GroupMember[]) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();
  const membershipsQuery = query(collectionGroup(database, "members"), where("userId", "==", userId));

  return onSnapshot(
    membershipsQuery,
    (snapshot) => {
      onMemberships(snapshot.docs.map((memberSnapshot) => ({ id: memberSnapshot.id, ...memberSnapshot.data() }) as GroupMember));
    },
    handleFirestoreError(onError)
  );
}

export function subscribeGroup(groupId: string, onGroup: (group?: Group) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();

  return onSnapshot(
    doc(database, "groups", groupId),
    (snapshot) => {
      onGroup(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Group) : undefined);
    },
    handleFirestoreError(onError)
  );
}

export function subscribeGroupMembers(groupId: string, onMembers: (members: GroupMember[]) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();
  const membersQuery = query(collection(database, "groups", groupId, "members"), orderBy("createdAt", "asc"));

  return onSnapshot(
    membersQuery,
    (snapshot) => {
      onMembers(sortByCreatedAt(snapshot.docs.map((memberSnapshot) => ({ id: memberSnapshot.id, ...memberSnapshot.data() }) as GroupMember), "asc"));
    },
    handleFirestoreError(onError)
  );
}

export function subscribeBalanceSnapshot(groupId: string, onBalanceSnapshot: (snapshot?: BalanceSnapshot) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();

  return onSnapshot(
    doc(database, "groups", groupId, "balanceSnapshots", "current"),
    (snapshot) => {
      onBalanceSnapshot(snapshot.exists() ? ({ id: "current", ...snapshot.data() } as BalanceSnapshot) : undefined);
    },
    handleFirestoreError(onError)
  );
}

export async function getGroupById(groupId: string) {
  const database = getFirestoreOrThrow();
  const snapshot = await getDoc(doc(database, "groups", groupId));

  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Group) : undefined;
}

export async function persistGroup(group: Group) {
  const database = getFirestoreOrThrow();

  await setDoc(doc(database, "groups", group.id), stripUndefined(group), { merge: true });
}

export async function persistMember(member: GroupMember) {
  const database = getFirestoreOrThrow();

  const batch = writeBatch(database);
  batch.set(doc(database, "groups", member.groupId, "members", member.id), stripUndefined(member), { merge: true });

  if (member.userId) {
    batch.set(
      doc(database, "groups", member.groupId, "memberAccess", member.userId),
      stripUndefined({
        userId: member.userId,
        memberId: member.id,
        role: member.role,
        permissions: member.permissions,
        status: member.status,
        updatedAt: member.updatedAt
      }),
      { merge: true }
    );
  }

  await batch.commit();
}

export async function persistGroupBundle({
  group,
  ownerMember,
  treasury,
  inviteCode,
  activity,
  activities,
  balanceSnapshot
}: {
  group: Group;
  ownerMember: GroupMember;
  treasury?: Treasury;
  inviteCode: string;
  activity?: Activity;
  activities?: Activity[];
  balanceSnapshot?: BalanceSnapshot;
}) {
  const database = getFirestoreOrThrow();
  const batch = writeBatch(database);
  const now = Date.now();

  batch.set(doc(database, "groups", group.id), stripUndefined(group), { merge: true });
  batch.set(doc(database, "groups", group.id, "members", ownerMember.id), stripUndefined(ownerMember), { merge: true });
  if (ownerMember.userId) {
    batch.set(
      doc(database, "groups", group.id, "memberAccess", ownerMember.userId),
      stripUndefined({
        userId: ownerMember.userId,
        memberId: ownerMember.id,
        role: ownerMember.role,
        permissions: ownerMember.permissions,
        status: ownerMember.status,
        updatedAt: ownerMember.updatedAt
      }),
      { merge: true }
    );
  }
  batch.set(
    doc(database, "invites", inviteCode),
    stripUndefined({
      id: inviteCode,
      code: inviteCode,
      groupId: group.id,
      createdByUserId: group.ownerUserId,
      status: "active",
      createdAt: now,
      updatedAt: now
    }),
    { merge: true }
  );

  for (const item of activities ?? (activity ? [activity] : [])) {
    batch.set(doc(database, "groups", group.id, "activities", item.id), stripUndefined(item), { merge: true });
  }

  batch.set(
    doc(database, "groups", group.id, "balanceSnapshots", "current"),
    stripUndefined(
      balanceSnapshot ?? {
        id: "current",
        groupId: group.id,
        balances: [],
        treasury,
        updatedAt: now
      }
    ),
    { merge: true }
  );

  await batch.commit();
}

export async function softRemoveMember(member: GroupMember, now = Date.now()) {
  await persistMember({
    ...member,
    status: "removed",
    removedAt: now,
    updatedAt: now
  });
}

export async function persistBalanceSnapshot(groupId: string, balances: Balance[], treasury?: Treasury, now = Date.now()) {
  const database = getFirestoreOrThrow();

  await setDoc(
    doc(database, "groups", groupId, "balanceSnapshots", "current"),
    stripUndefined({
      id: "current",
      groupId,
      balances,
      treasury,
      updatedAt: now
    } satisfies BalanceSnapshot),
    { merge: true }
  );
}

export function subscribeOptionalGroup(groupId: string | undefined, onGroup: (group?: Group) => void, onError?: FirestoreFailureHandler) {
  if (!groupId) {
    return noopUnsubscribe;
  }

  return subscribeGroup(groupId, onGroup, onError);
}

function makeGroupId(name: string, now: number) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);

  return `group_${slug || "new"}_${now.toString(36)}`;
}

function makeMemberId(groupId: string, displayName: string, now: number) {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 18);

  return `member_${slug || "guest"}_${groupId.replace(/^group_/, "").slice(0, 12)}_${now.toString(36)}`;
}

function makeInviteCode(name: string, now: number) {
  const prefix = name
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "A");

  return `${prefix}-${now.toString(36).slice(-4).toUpperCase()}`;
}
