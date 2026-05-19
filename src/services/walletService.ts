import { collection, doc, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";
import type { LocalWallet } from "../models";
import {
  getFirestoreOrThrow,
  handleFirestoreError,
  sortByCreatedAt,
  stripUndefined,
  type FirestoreFailureHandler
} from "./firestoreHelpers";

type PersistedWallet = Omit<LocalWallet, "status"> & {
  userId: string;
  updatedAt: number;
  removedAt?: number;
  status: LocalWallet["status"] | "removed";
};

export function subscribeUserWallets(userId: string, onWallets: (wallets: LocalWallet[]) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();
  const walletsQuery = query(collection(database, "wallets"), where("userId", "==", userId));

  return onSnapshot(
    walletsQuery,
    (snapshot) => {
      const wallets = snapshot.docs
        .map((walletSnapshot) => ({ id: walletSnapshot.id, ...(walletSnapshot.data() as Omit<PersistedWallet, "id">) }))
        .filter((wallet) => wallet.status !== "removed")
        .map(({ userId: _userId, updatedAt: _updatedAt, removedAt: _removedAt, ...wallet }) => wallet as LocalWallet);

      onWallets(sortByCreatedAt(wallets, "asc"));
    },
    handleFirestoreError(onError)
  );
}

export async function upsertWallet(userId: string, wallet: LocalWallet) {
  const database = getFirestoreOrThrow();

  await setDoc(
    doc(database, "wallets", wallet.id),
    stripUndefined({
      ...wallet,
      userId,
      updatedAt: Date.now()
    } satisfies PersistedWallet),
    { merge: true }
  );
}

export async function syncWallets(userId: string, wallets: LocalWallet[]) {
  const database = getFirestoreOrThrow();
  const batch = writeBatch(database);
  const now = Date.now();

  for (const wallet of wallets) {
    batch.set(
      doc(database, "wallets", wallet.id),
      stripUndefined({
        ...wallet,
        userId,
        updatedAt: now
      } satisfies PersistedWallet),
      { merge: true }
    );
  }

  await batch.commit();
}

export async function softRemoveWallet(userId: string, walletId: string) {
  const database = getFirestoreOrThrow();
  const now = Date.now();

  await setDoc(
    doc(database, "wallets", walletId),
    {
      userId,
      status: "removed",
      removedAt: now,
      updatedAt: now
    } satisfies Partial<PersistedWallet>,
    { merge: true }
  );
}
