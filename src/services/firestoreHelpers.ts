import type { DocumentData, Firestore, FirestoreError, QueryDocumentSnapshot, Unsubscribe } from "firebase/firestore";
import { db, firebaseMissingEnvVars } from "../lib/firebase";

export type FirestoreFailureHandler = (message: string) => void;

export const noopUnsubscribe: Unsubscribe = () => undefined;

export function getFirestoreOrThrow(): Firestore {
  if (!db) {
    throw new Error(`Firebase is not configured. Missing ${firebaseMissingEnvVars.join(", ") || "configuration"}.`);
  }

  return db;
}

export function handleFirestoreError(onError?: FirestoreFailureHandler) {
  return (error: FirestoreError | Error) => {
    onError?.(friendlyFirestoreMessage(error));
  };
}

export function friendlyFirestoreMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Firebase sync failed.";
}

export function withDocumentId<T extends { id: string }>(snapshot: QueryDocumentSnapshot<DocumentData>): T {
  return {
    id: snapshot.id,
    ...stripUndefined(snapshot.data())
  } as T;
}

export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((clean, [key, nested]) => {
    if (nested !== undefined) {
      clean[key] = stripUndefined(nested);
    }

    return clean;
  }, {}) as T;
}

export function sortByCreatedAt<T extends { createdAt?: number }>(items: T[], direction: "asc" | "desc" = "desc") {
  return [...items].sort((a, b) => {
    const diff = (a.createdAt ?? 0) - (b.createdAt ?? 0);
    return direction === "asc" ? diff : -diff;
  });
}
