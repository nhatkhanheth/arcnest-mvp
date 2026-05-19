import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreOrThrow, stripUndefined } from "./firestoreHelpers";

export type InviteRecord = {
  id: string;
  code: string;
  groupId: string;
  createdByUserId?: string;
  status: "active" | "revoked" | "expired";
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  revokedAt?: number;
  usedCount?: number;
  lastUsedAt?: number;
  lastUsedByUserId?: string;
};

export function validateInvitePreview(code: string) {
  return code.trim().length >= 4;
}

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

export function isValidInviteCode(code: string) {
  return /^[A-Z0-9]{3,}-[A-Z0-9]{3,}$/.test(normalizeInviteCode(code));
}

export function getInviteResolvedStatus(invite: InviteRecord, now = Date.now()): InviteRecord["status"] {
  if (invite.status === "active" && invite.expiresAt && invite.expiresAt <= now) {
    return "expired";
  }

  return invite.status;
}

export async function getInviteByCode(code: string) {
  const database = getFirestoreOrThrow();
  const normalizedCode = normalizeInviteCode(code);
  const snapshot = await getDoc(doc(database, "invites", normalizedCode));

  if (!snapshot.exists()) {
    return undefined;
  }

  return {
    id: snapshot.id,
    ...snapshot.data()
  } as InviteRecord;
}

export async function persistInvite(invite: InviteRecord) {
  const database = getFirestoreOrThrow();
  const code = normalizeInviteCode(invite.code);

  await setDoc(doc(database, "invites", code), stripUndefined({ ...invite, id: code, code }), { merge: true });
}

export async function recordInviteUsed(invite: InviteRecord, usedByUserId?: string, now = Date.now()) {
  await persistInvite({
    ...invite,
    status: getInviteResolvedStatus(invite, now),
    usedCount: (invite.usedCount ?? 0) + 1,
    lastUsedAt: now,
    lastUsedByUserId: usedByUserId,
    updatedAt: now
  });
}
