import { useSyncExternalStore } from "react";
import { firebaseConfigured, firebaseMissingEnvVars } from "../lib/firebase";
import { subscribeAnonymousUserProfile, type FirebaseUserProfile } from "../services/userService";

export type AuthStoreSnapshot = {
  profile?: FirebaseUserProfile;
  mode: "firebase" | "local";
  loading: boolean;
  error?: string;
  missingEnvVars: string[];
};

const listeners = new Set<() => void>();
let unsubscribeAuth: (() => void) | undefined;
let state: AuthStoreSnapshot = {
  mode: firebaseConfigured ? "firebase" : "local",
  loading: firebaseConfigured,
  missingEnvVars: firebaseMissingEnvVars
};

export function useAuthStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function startAuthStore() {
  if (unsubscribeAuth || !firebaseConfigured) {
    if (!firebaseConfigured) {
      setState({
        mode: "local",
        loading: false,
        missingEnvVars: firebaseMissingEnvVars,
        error: undefined
      });
    }

    return;
  }

  unsubscribeAuth = subscribeAnonymousUserProfile({
    onProfile(profile) {
      setState({
        profile,
        mode: "firebase",
        loading: false,
        missingEnvVars: [],
        error: undefined
      });
    },
    onError(message) {
      setState({
        ...state,
        mode: "firebase",
        loading: false,
        error: message
      });
    },
    onLocalMode(message) {
      setState({
        mode: "local",
        loading: false,
        missingEnvVars: firebaseMissingEnvVars,
        error: message
      });
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function setState(nextState: AuthStoreSnapshot) {
  state = nextState;
  listeners.forEach((listener) => listener());
}
