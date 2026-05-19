import { doc, onSnapshot, setDoc } from "firebase/firestore";
import type { SettingsState } from "../state/useSettingsStore";
import { getFirestoreOrThrow, handleFirestoreError, noopUnsubscribe, stripUndefined, type FirestoreFailureHandler } from "./firestoreHelpers";

export type PersistedSettings = Omit<SettingsState, "wallets"> & {
  updatedAt: number;
};

export function subscribeUserSettings(userId: string, onSettings: (settings?: Partial<PersistedSettings>) => void, onError?: FirestoreFailureHandler) {
  const database = getFirestoreOrThrow();

  return onSnapshot(
    doc(database, "users", userId, "settings", "preferences"),
    (snapshot) => {
      onSettings(snapshot.exists() ? (snapshot.data() as Partial<PersistedSettings>) : undefined);
    },
    handleFirestoreError(onError)
  );
}

export async function saveUserSettings(userId: string, settings: SettingsState) {
  const database = getFirestoreOrThrow();
  const { wallets: _wallets, ...settingsWithoutWallets } = settings;

  await setDoc(
    doc(database, "users", userId, "settings", "preferences"),
    stripUndefined({
      ...settingsWithoutWallets,
      updatedAt: Date.now()
    }),
    { merge: true }
  );
}

export function subscribeOptionalUserSettings(userId: string | undefined, onSettings: (settings?: Partial<PersistedSettings>) => void, onError?: FirestoreFailureHandler) {
  if (!userId) {
    return noopUnsubscribe;
  }

  return subscribeUserSettings(userId, onSettings, onError);
}
