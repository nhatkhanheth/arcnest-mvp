import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously,
  type User as FirebaseAuthUser
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, updateDoc, type Unsubscribe } from "firebase/firestore";
import { currentUser } from "../data/mockData";
import { auth, db, firebaseConfigured, firebaseMissingEnvVars } from "../lib/firebase";
import type { User } from "../models";
import { friendlyFirestoreMessage, handleFirestoreError, noopUnsubscribe, stripUndefined } from "./firestoreHelpers";

export type FirebaseUserProfile = User & {
  activeGroupId?: string;
  authProvider: "anonymous";
  firebaseUid: string;
  seededFromLocalAt?: number;
};

let persistenceReady: Promise<void> | undefined;

export function getCurrentUserPreview() {
  return auth?.currentUser?.uid ?? currentUser.id;
}

export function subscribeAnonymousUserProfile({
  onProfile,
  onError,
  onLocalMode
}: {
  onProfile: (profile: FirebaseUserProfile) => void;
  onError?: (message: string) => void;
  onLocalMode?: (message: string) => void;
}): Unsubscribe {
  if (!firebaseConfigured || !auth || !db) {
    onLocalMode?.(`Firebase env is incomplete. Missing ${firebaseMissingEnvVars.join(", ")}.`);
    return noopUnsubscribe;
  }

  const firebaseAuth = auth;
  let profileUnsubscribe: Unsubscribe | undefined;

  void ensureAnonymousSession().catch((error) => onError?.(friendlyFirestoreMessage(error)));

  const authUnsubscribe = onAuthStateChanged(
    firebaseAuth,
    (firebaseUser) => {
      profileUnsubscribe?.();
      profileUnsubscribe = undefined;

      if (!firebaseUser) {
        void signInAnonymously(firebaseAuth).catch((error) => onError?.(friendlyFirestoreMessage(error)));
        return;
      }

      void bootstrapUserProfile(firebaseUser)
        .then(() => {
          profileUnsubscribe = subscribeUserProfile(firebaseUser.uid, onProfile, onError);
        })
        .catch((error) => onError?.(friendlyFirestoreMessage(error)));
    },
    handleFirestoreError(onError)
  );

  return () => {
    profileUnsubscribe?.();
    authUnsubscribe();
  };
}

export async function bootstrapUserProfile(firebaseUser: FirebaseAuthUser) {
  if (!db) {
    return;
  }

  const now = Date.now();
  const ref = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(ref);

  if (snapshot.exists()) {
    await updateDoc(ref, {
      lastSeenAt: now,
      updatedAt: now
    });
    return;
  }

  const profile: FirebaseUserProfile = {
    ...currentUser,
    id: firebaseUser.uid,
    email: firebaseUser.email ?? undefined,
    displayName: currentUser.displayName || `ArcNest ${firebaseUser.uid.slice(0, 5)}`,
    authProvider: "anonymous",
    firebaseUid: firebaseUser.uid,
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now
  };

  await setDoc(ref, stripUndefined(profile), { merge: true });
}

export function subscribeUserProfile(userId: string, onProfile: (profile: FirebaseUserProfile) => void, onError?: (message: string) => void) {
  if (!db) {
    onError?.("Firebase is not configured.");
    return noopUnsubscribe;
  }

  return onSnapshot(
    doc(db, "users", userId),
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      onProfile({
        id: snapshot.id,
        ...(snapshot.data() as Omit<FirebaseUserProfile, "id">)
      });
    },
    handleFirestoreError(onError)
  );
}

export async function updateUserProfile(userId: string, patch: Partial<FirebaseUserProfile>) {
  if (!db) {
    return;
  }

  await setDoc(
    doc(db, "users", userId),
    stripUndefined({
      ...patch,
      updatedAt: Date.now()
    }),
    { merge: true }
  );
}

export function setUserActiveGroup(userId: string, activeGroupId: string) {
  return updateUserProfile(userId, { activeGroupId });
}

export function markUserSeededFromLocal(userId: string, seededFromLocalAt = Date.now()) {
  return updateUserProfile(userId, { seededFromLocalAt });
}

async function ensureAnonymousSession() {
  if (!auth) {
    return;
  }

  persistenceReady ??= setPersistence(auth, browserLocalPersistence);
  await persistenceReady;

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }
}
