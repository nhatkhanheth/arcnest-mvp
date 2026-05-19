import { collection, doc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import type { TreasuryTransaction } from "../models";
import { getFirestoreOrThrow, handleFirestoreError, sortByCreatedAt, stripUndefined, type FirestoreFailureHandler } from "./firestoreHelpers";

export function getTreasuryPreviewBalance(balanceUSDC?: string) {
  return balanceUSDC ?? "0.00";
}

export function subscribeTreasuryTransactions(groupId: string, onTransactions: (transactions: TreasuryTransaction[]) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();
  const transactionsQuery = query(collection(database, "groups", groupId, "treasuryTransactions"), orderBy("createdAt", "desc"));

  return onSnapshot(
    transactionsQuery,
    (snapshot) => {
      onTransactions(
        sortByCreatedAt(snapshot.docs.map((transactionSnapshot) => ({ id: transactionSnapshot.id, ...transactionSnapshot.data() }) as TreasuryTransaction))
      );
    },
    handleFirestoreError(onError)
  );
}

export async function persistTreasuryTransaction(transaction: TreasuryTransaction) {
  const database = getFirestoreOrThrow();

  await setDoc(doc(database, "groups", transaction.groupId, "treasuryTransactions", transaction.id), stripUndefined(transaction), { merge: true });
}
