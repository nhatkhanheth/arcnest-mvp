import { useSyncExternalStore } from "react";
import { primaryWallet } from "../data/mockData";
import type { DisplayCurrency, LanguageCode, LocalWallet, SettingsSplitMode, ThemeMode } from "../models";
import { saveUserSettings, subscribeUserSettings } from "../services/settingsService";
import type { FirebaseUserProfile } from "../services/userService";
import { updateUserProfile } from "../services/userService";
import { softRemoveWallet, subscribeUserWallets, syncWallets, upsertWallet } from "../services/walletService";

const storageKey = "arcnest-settings-v1";

export type SettingsState = {
  version: 1;
  language: LanguageCode;
  displayCurrency: DisplayCurrency;
  theme: ThemeMode;
  soundEnabled: boolean;
  reducedMotion: boolean;
  walletConnected: boolean;
  wallets: LocalWallet[];
  activeWalletId: string;
  autoLockWallet: boolean;
  requirePaymentConfirmation: boolean;
  hideSmallBalances: boolean;
  showWalletAddress: boolean;
  defaultSplitMode: SettingsSplitMode;
  defaultGroupCurrency: "VND" | "USD";
  paymentConfirmationReminder: boolean;
};

type ConnectedWalletInput = {
  address: string;
  connectorId?: string;
  connectorName?: string;
  chainId?: number;
};

const initialState: SettingsState = {
  version: 1,
  language: "en",
  displayCurrency: "USDC",
  theme: "arc-dark",
  soundEnabled: true,
  reducedMotion: false,
  walletConnected: true,
  wallets: [
    {
      id: "local_wallet_embedded",
      label: "ArcNest embedded",
      address: primaryWallet.address,
      type: "embedded",
      isPrimary: true,
      status: "active",
      createdAt: primaryWallet.createdAt
    },
    {
      id: "local_wallet_readonly",
      label: "Savings watch",
      address: "0x91C6c36d4B2fA29f6E0a1A3B0d57A50b2A847EC2",
      type: "readonly",
      isPrimary: false,
      status: "active",
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 12
    }
  ],
  activeWalletId: "local_wallet_embedded",
  autoLockWallet: true,
  requirePaymentConfirmation: true,
  hideSmallBalances: false,
  showWalletAddress: true,
  defaultSplitMode: "equal",
  defaultGroupCurrency: "VND",
  paymentConfirmationReminder: true
};

let state = loadState();
const listeners = new Set<() => void>();
let remoteUserId: string | undefined;
let settingsUnsubscribe: (() => void) | undefined;
let walletsUnsubscribe: (() => void) | undefined;
let remoteSettingsHydrated = false;
let remoteWalletsHydrated = false;
let syncError: string | undefined;

export function useSettingsStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    ...snapshot,
    activeWallet: getActiveWallet(snapshot),
    primaryWallet: getPrimaryWallet(snapshot),
    firebaseSyncError: syncError,
    ...actions
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function setState(updater: (current: SettingsState) => SettingsState) {
  state = updater(state);
  persistState(state);
  listeners.forEach((listener) => listener());
}

function loadState(): SettingsState {
  if (typeof window === "undefined") {
    return initialState;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);

    if (!raw) {
      return initialState;
    }

    const parsed = JSON.parse(raw) as Partial<SettingsState>;

    if (parsed.version !== 1) {
      return initialState;
    }

    return {
      ...initialState,
      ...parsed,
      wallets: normalizeWallets(parsed.wallets ?? initialState.wallets),
      activeWalletId: parsed.activeWalletId ?? initialState.activeWalletId
    };
  } catch {
    return initialState;
  }
}

function persistState(nextState: SettingsState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(nextState));
}

export function connectSettingsStoreToFirebase(profile?: FirebaseUserProfile) {
  if (!profile) {
    return;
  }

  if (remoteUserId === profile.id) {
    return;
  }

  settingsUnsubscribe?.();
  walletsUnsubscribe?.();
  remoteUserId = profile.id;
  remoteSettingsHydrated = false;
  remoteWalletsHydrated = false;
  syncError = undefined;

  settingsUnsubscribe = subscribeUserSettings(
    profile.id,
    (remoteSettings) => {
      if (!remoteSettings) {
        if (!remoteSettingsHydrated) {
          remoteSettingsHydrated = true;
          syncRemoteSettings();
        }
        return;
      }

      remoteSettingsHydrated = true;
      setState((current) => ({
        ...current,
        ...remoteSettings,
        wallets: current.wallets,
        version: 1,
        activeWalletId: remoteSettings.activeWalletId ?? current.activeWalletId
      }));
    },
    setRemoteError
  );

  walletsUnsubscribe = subscribeUserWallets(
    profile.id,
    (wallets) => {
      if (wallets.length === 0) {
        if (!remoteWalletsHydrated) {
          remoteWalletsHydrated = true;
          syncRemoteWallets(state.wallets);
        }
        return;
      }

      remoteWalletsHydrated = true;
      setState((current) => {
        const normalized = normalizeWallets(wallets);
        const activeWalletId = normalized.some((wallet) => wallet.id === current.activeWalletId)
          ? current.activeWalletId
          : getPrimaryWallet({ ...current, wallets: normalized }).id;

        return {
          ...current,
          wallets: normalized,
          activeWalletId,
          walletConnected: normalized.some((wallet) => wallet.status === "active")
        };
      });
    },
    setRemoteError
  );
}

function syncRemoteSettings() {
  if (!remoteUserId) {
    return;
  }

  void saveUserSettings(remoteUserId, state).catch(setRemoteError);
}

function syncRemoteWallet(wallet: LocalWallet) {
  if (!remoteUserId) {
    return;
  }

  void upsertWallet(remoteUserId, wallet).catch(setRemoteError);
}

function syncRemoteWallets(wallets: LocalWallet[]) {
  if (!remoteUserId) {
    return;
  }

  void syncWallets(remoteUserId, wallets).catch(setRemoteError);
}

function setRemoteError(error: unknown) {
  syncError = error instanceof Error ? error.message : String(error);
  listeners.forEach((listener) => listener());
}

const actions = {
  setLanguage(language: LanguageCode) {
    setState((current) => ({ ...current, language }));
    syncRemoteSettings();
  },
  setDisplayCurrency(displayCurrency: DisplayCurrency) {
    setState((current) => ({ ...current, displayCurrency }));
    syncRemoteSettings();
  },
  setTheme(theme: ThemeMode) {
    setState((current) => ({ ...current, theme }));
    syncRemoteSettings();
  },
  setDefaultSplitMode(defaultSplitMode: SettingsSplitMode) {
    setState((current) => ({ ...current, defaultSplitMode }));
    syncRemoteSettings();
  },
  setDefaultGroupCurrency(defaultGroupCurrency: SettingsState["defaultGroupCurrency"]) {
    setState((current) => ({ ...current, defaultGroupCurrency }));
    syncRemoteSettings();
  },
  toggle(key: BooleanSettingKey) {
    setState((current) => ({ ...current, [key]: !current[key] }));
    syncRemoteSettings();
  },
  setWalletConnected(walletConnected: boolean) {
    setState((current) => ({ ...current, walletConnected }));
    syncRemoteSettings();
  },
  addWalletMock() {
    let walletToPersist: LocalWallet | undefined;
    setState((current) => {
      const now = Date.now();
      const wallet: LocalWallet = {
        id: `local_wallet_${now.toString(36)}`,
        label: `Manual wallet ${current.wallets.length + 1}`,
        address: makeMockWalletAddress(now),
        type: "manual",
        isPrimary: current.wallets.length === 0,
        status: "active",
        createdAt: now
      };
      walletToPersist = wallet;

      return {
        ...current,
        wallets: [...current.wallets, wallet],
        activeWalletId: wallet.id,
        walletConnected: true
      };
    });
    syncRemoteSettings();
    if (walletToPersist) {
      syncRemoteWallet(walletToPersist);
    }
  },
  removeWallet(walletId: string) {
    let removedWalletId: string | undefined;
    setState((current) => {
      if (current.wallets.length <= 1) {
        return current;
      }

      const removed = current.wallets.find((wallet) => wallet.id === walletId);
      removedWalletId = removed?.id;
      const remaining = current.wallets.filter((wallet) => wallet.id !== walletId);
      const nextPrimaryId = removed?.isPrimary ? remaining[0]?.id : remaining.find((wallet) => wallet.isPrimary)?.id;
      const wallets = remaining.map((wallet) => ({ ...wallet, isPrimary: wallet.id === nextPrimaryId }));
      const activeWalletId = current.activeWalletId === walletId ? wallets[0]?.id ?? current.activeWalletId : current.activeWalletId;

      return {
        ...current,
        wallets,
        activeWalletId,
        walletConnected: wallets.some((wallet) => wallet.status === "active")
      };
    });
    syncRemoteSettings();
    if (remoteUserId && removedWalletId) {
      void softRemoveWallet(remoteUserId, removedWalletId).catch(setRemoteError);
    }
  },
  setPrimaryWallet(walletId: string) {
    setState((current) => ({
      ...current,
      wallets: current.wallets.map((wallet) => ({
        ...wallet,
        isPrimary: wallet.id === walletId,
        status: wallet.id === walletId ? "active" : wallet.status
      })),
      activeWalletId: walletId,
      walletConnected: true
    }));
    syncRemoteSettings();
    syncRemoteWallets(state.wallets);
    const primary = state.wallets.find((wallet) => wallet.id === walletId);
    if (remoteUserId && primary) {
      void updateUserProfile(remoteUserId, { primaryWalletAddress: primary.address }).catch(setRemoteError);
    }
  },
  setActiveWallet(walletId: string) {
    setState((current) => ({
      ...current,
      activeWalletId: walletId,
      wallets: current.wallets.map((wallet) => (wallet.id === walletId ? { ...wallet, status: "active" } : wallet)),
      walletConnected: true
    }));
    syncRemoteSettings();
    const activeWallet = state.wallets.find((wallet) => wallet.id === walletId);
    if (activeWallet) {
      syncRemoteWallet(activeWallet);
    }
  },
  toggleWalletStatus(walletId: string) {
    let changedWallet: LocalWallet | undefined;
    setState((current) => {
      const wallets: LocalWallet[] = current.wallets.map((wallet): LocalWallet =>
        wallet.id === walletId
          ? {
              ...wallet,
              status: wallet.status === "active" ? "disconnected" : "active"
            }
          : wallet
      );
      changedWallet = wallets.find((wallet) => wallet.id === walletId);
      const activeWallet = wallets.find((wallet) => wallet.id === current.activeWalletId);

      return {
        ...current,
        wallets,
        activeWalletId: activeWallet?.status === "disconnected" ? wallets.find((wallet) => wallet.status === "active")?.id ?? current.activeWalletId : current.activeWalletId,
        walletConnected: wallets.some((wallet) => wallet.status === "active")
      };
    });
    syncRemoteSettings();
    if (changedWallet) {
      syncRemoteWallet(changedWallet);
    }
  },
  upsertConnectedWallet(input: ConnectedWalletInput) {
    let primaryAddress: string | undefined;
    setState((current) => {
      const now = Date.now();
      const existing = current.wallets.find((wallet) => wallet.address.toLowerCase() === input.address.toLowerCase());
      const walletId = existing?.id ?? `external_wallet_${input.address.toLowerCase().replace(/^0x/, "")}`;
      const connectedWallet: LocalWallet = {
        ...existing,
        id: walletId,
        label: input.connectorName ? `${input.connectorName} wallet` : existing?.label ?? "Connected wallet",
        address: input.address,
        type: "external",
        provider: inferWalletProvider(input.connectorId, input.connectorName),
        connectorId: input.connectorId,
        connectorName: input.connectorName,
        chainId: input.chainId,
        isPrimary: true,
        status: "active",
        createdAt: existing?.createdAt ?? now,
        lastConnectedAt: now
      };
      const wallets = current.wallets.some((wallet) => wallet.id === walletId)
        ? current.wallets.map((wallet) => (wallet.id === walletId ? connectedWallet : { ...wallet, isPrimary: false }))
        : [...current.wallets.map((wallet) => ({ ...wallet, isPrimary: false })), connectedWallet];

      primaryAddress = connectedWallet.address;

      return {
        ...current,
        wallets,
        activeWalletId: walletId,
        walletConnected: true
      };
    });
    syncRemoteSettings();
    syncRemoteWallets(state.wallets);

    if (remoteUserId && primaryAddress) {
      void updateUserProfile(remoteUserId, { primaryWalletAddress: primaryAddress }).catch(setRemoteError);
    }
  },
  disconnectConnectedWallet(address: string) {
    let changedWallet: LocalWallet | undefined;
    setState((current) => {
      const wallets = current.wallets.map((wallet) => {
        if (wallet.address.toLowerCase() !== address.toLowerCase()) {
          return wallet;
        }

        changedWallet = {
          ...wallet,
          status: "disconnected"
        };
        return changedWallet;
      });
      const activeWallet = wallets.find((wallet) => wallet.id === current.activeWalletId);
      const nextActiveWalletId =
        activeWallet?.status === "active" ? current.activeWalletId : wallets.find((wallet) => wallet.status === "active")?.id ?? current.activeWalletId;

      return {
        ...current,
        wallets,
        activeWalletId: nextActiveWalletId,
        walletConnected: wallets.some((wallet) => wallet.status === "active")
      };
    });
    syncRemoteSettings();

    if (changedWallet) {
      syncRemoteWallet(changedWallet);
    }
  }
};

type BooleanSettingKey = {
  [Key in keyof SettingsState]: SettingsState[Key] extends boolean ? Key : never;
}[keyof SettingsState];

function normalizeWallets(wallets: LocalWallet[]) {
  if (wallets.length === 0) {
    return initialState.wallets;
  }

  const hasPrimary = wallets.some((wallet) => wallet.isPrimary);
  return wallets.map((wallet, index) => ({
    ...wallet,
    isPrimary: hasPrimary ? wallet.isPrimary : index === 0
  }));
}

function getActiveWallet(snapshot: SettingsState) {
  return snapshot.wallets.find((wallet) => wallet.id === snapshot.activeWalletId) ?? getPrimaryWallet(snapshot);
}

function getPrimaryWallet(snapshot: SettingsState) {
  return snapshot.wallets.find((wallet) => wallet.isPrimary) ?? snapshot.wallets[0] ?? initialState.wallets[0];
}

function makeMockWalletAddress(now: number) {
  const seed = `arcnest${now}${Math.round(Math.random() * 100000)}`;
  const hex = Array.from(seed).reduce((value, char) => value + char.charCodeAt(0).toString(16), "");
  return `0x${hex.padEnd(40, "0").slice(0, 40)}`;
}

function inferWalletProvider(connectorId?: string, connectorName?: string): LocalWallet["provider"] {
  const source = `${connectorId ?? ""} ${connectorName ?? ""}`.toLowerCase();

  if (source.includes("metamask")) {
    return "metamask";
  }

  if (source.includes("rabby")) {
    return "rabby";
  }

  if (source.includes("walletconnect")) {
    return "walletconnect";
  }

  return "manual";
}
