import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection, useDisconnect } from "wagmi";
import { GlobalHeaderActions } from "../components/app/GlobalHeaderActions";
import { SettingsSheet } from "../components/settings/SettingsSheet";
import { BottomNav } from "../components/ui/BottomNav";
import { CreateGroupSheet } from "../components/groups/CreateGroupSheet";
import { JoinGroupSheet } from "../components/groups/JoinGroupSheet";
import { WelcomeScreen } from "../components/onboarding/WelcomeScreen";
import { PaymentSheet } from "../components/payments/PaymentSheet";
import { QRPaySheet } from "../components/payments/QRPaySheet";
import { SendSheet } from "../components/payments/SendSheet";
import type { NavTab } from "./routes";
import type { ArcNestInviteQRPayload, ArcNestPaymentQRPayload, PaymentRequest } from "../models";
import { getArcPaymentMode } from "../lib/arc";
import { extractInviteCodeFromPath } from "../services/inviteService";
import { ActivityPage } from "../pages/ActivityPage";
import { GroupDetailPage } from "../pages/GroupDetailPage";
import { GroupsPage } from "../pages/GroupsPage";
import { HomePage } from "../pages/HomePage";
import { SplitPage } from "../pages/SplitPage";
import { WalletPage } from "../pages/WalletPage";
import { useGroupStore } from "../state/useGroupStore";
import { connectGroupStoreToFirebase, resetGroupStoreSession } from "../state/useGroupStore";
import { startAuthStore, useAuthStore } from "../state/useAuthStore";
import { useSettingsStore } from "../state/useSettingsStore";
import { connectSettingsStoreToFirebase } from "../state/useSettingsStore";
import { fetchArcUSDCBalance } from "../services/arcBalanceService";
import { USDC_VND_RATE } from "../services/balanceService";

type QRMode = "scan" | "myqr" | "payload" | "invite";
type GroupOpenContext = { expenseId?: string; paymentId?: string };
type RouteState = { tab: NavTab; groupId?: string; expenseId?: string; paymentId?: string };
type AppLockState = { enabled: boolean; passcodeHash?: string; locked: boolean; timeoutMinutes: number; lastActiveAt?: number };
type PasscodeResult = { ok: boolean; message?: string };
type SessionMode = "none" | "wallet" | "demo";
const onboardingStorageKey = "arcnest_onboarding_completed";
const navStorageKey = "arcnest_last_route_v1";
const appLockStorageKey = "arcnest_app_lock_v1";
const sessionStorageKey = "arcnest_session_mode_v1";
const defaultAutoLockMinutes = 15;

export function App() {
  const {
    activeGroupId,
    currentUser,
    firebaseSync,
    groups,
    inviteCodes,
    members,
    payments,
    wallet,
    completePayment,
    ensureInviteForGroup,
    markPaymentFailed,
    retryPayment,
    setPrimaryWalletAddress,
    setWalletBalance,
    startPayment,
    switchActiveGroup
  } = useGroupStore();
  const authState = useAuthStore();
  const settings = useSettingsStore();
  const { theme, setTheme, reducedMotion, primaryWallet } = settings;
  const connection = useConnection();
  const { disconnectAsync } = useDisconnect();
  const initialRoute = useRef<RouteState>(getInitialRouteState());
  const [activeTab, setActiveTab] = useState<NavTab>(initialRoute.current.tab);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(initialRoute.current.groupId ?? null);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | undefined>(initialRoute.current.expenseId);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | undefined>(initialRoute.current.paymentId);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinInitialCode, setJoinInitialCode] = useState<string>();
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest>();
  const [paymentId, setPaymentId] = useState<string>();
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string>();
  const [sendOpen, setSendOpen] = useState(false);
  const [qrOpen, setQROpen] = useState(false);
  const [qrMode, setQRMode] = useState<QRMode>("scan");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(() => getStoredOnboardingComplete());
  const [sessionMode, setSessionMode] = useState<SessionMode>(() => getStoredSessionMode());
  const [appLock, setAppLock] = useState<AppLockState>(() => getStoredAppLockState());
  const [unlockError, setUnlockError] = useState<string>();
  const previousWalletAddress = useRef(primaryWallet.address);
  const appConnectionKey = useRef<string>();
  const appConnectionAddress = useRef<string>();
  const appLockActivitySavedAt = useRef(0);
  const pendingInviteCode = useRef<string | undefined>(getInitialInviteCode());

  useEffect(() => {
    startAuthStore();
  }, []);

  useEffect(() => {
    function handlePopState() {
      applyRouteState(getRouteStateFromUrl(), { switchGroup: true });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    connectSettingsStoreToFirebase(authState.profile);
  }, [authState.profile]);

  useEffect(() => {
    if (!connection.isConnected || !connection.address) {
      if (connection.isDisconnected && appConnectionAddress.current) {
        settings.disconnectConnectedWallet(appConnectionAddress.current);
        appConnectionAddress.current = undefined;
        appConnectionKey.current = undefined;
      }
      return;
    }

    const connectionKey = [connection.address, connection.chainId, connection.connector?.id].join(":");

    if (appConnectionKey.current === connectionKey) {
      return;
    }

    appConnectionKey.current = connectionKey;
    appConnectionAddress.current = connection.address;
    settings.upsertConnectedWallet({
      address: connection.address,
      chainId: connection.chainId,
      connectorId: connection.connector?.id,
      connectorName: connection.connector?.name
    });
  }, [
    connection.address,
    connection.chainId,
    connection.connector?.id,
    connection.connector?.name,
    connection.isConnected,
    connection.isDisconnected,
    settings
  ]);

  useEffect(() => {
    if (!authState.profile || sessionMode !== "wallet" || !isWalletSessionActive(settings, connection)) {
      if (sessionMode !== "demo") {
        resetGroupStoreSession();
      }
      return;
    }

    connectGroupStoreToFirebase({
      ...authState.profile,
      primaryWalletAddress: primaryWallet.address
    });
  }, [authState.profile, connection.address, connection.isConnected, primaryWallet.address, primaryWallet.status, sessionMode, settings.walletConnected]);

  useEffect(() => {
    if (!isWalletSessionActive(settings, connection)) {
      setWalletBalance({ balanceUSDC: "0", balanceVND: 0 });
      return;
    }

    setPrimaryWalletAddress(primaryWallet.address);
  }, [connection.address, connection.isConnected, primaryWallet.address, primaryWallet.status, setPrimaryWalletAddress, setWalletBalance, settings.walletConnected]);

  useEffect(() => {
    if (sessionMode !== "wallet" || isWalletSessionActive(settings, connection)) {
      return;
    }

    if (connection.isConnected && connection.address) {
      return;
    }

    resetGroupStoreSession();
    setStoredSessionMode("none");
    setSessionMode("none");
    setStoredOnboardingComplete(false);
    setOnboardingComplete(false);
    commitRoute({ tab: "home" }, { replace: true });
  }, [connection.address, connection.isConnected, primaryWallet.address, primaryWallet.status, sessionMode, settings.walletConnected]);

  useEffect(() => {
    const previous = previousWalletAddress.current;
    previousWalletAddress.current = primaryWallet.address;

    if (isWalletSessionActive(settings, connection) && primaryWallet.address && primaryWallet.address !== previous) {
      setStoredSessionMode("wallet");
      setSessionMode("wallet");
      commitRoute({ tab: "home" }, { replace: true });

      if (!onboardingComplete || appLock.locked) {
        completeOnboarding();
      }
    }
  }, [appLock.locked, connection.address, connection.isConnected, onboardingComplete, primaryWallet.address, primaryWallet.status, settings.walletConnected]);

  useEffect(() => {
    if (!isWalletSessionActive(settings, connection)) {
      return;
    }

    let cancelled = false;

    async function refreshBalance() {
      try {
        const balance = await fetchArcUSDCBalance(primaryWallet.address);

        if (!cancelled) {
          setWalletBalance(balance);
        }
      } catch {
        if (!cancelled) {
          setWalletBalance({ balanceUSDC: "0", balanceVND: 0 });
        }
      }
    }

    void refreshBalance();
    const interval = window.setInterval(() => void refreshBalance(), 20_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection.address, connection.isConnected, primaryWallet.address, primaryWallet.status, setWalletBalance, settings.walletConnected]);

  useEffect(() => {
    if (!onboardingComplete || !pendingInviteCode.current) {
      return;
    }

    setJoinInitialCode(pendingInviteCode.current);
    setJoinOpen(true);
    pendingInviteCode.current = undefined;
  }, [onboardingComplete]);

  useEffect(() => {
    if (!appLock.enabled || appLock.locked || !settings.autoLockWallet) {
      return;
    }

    const timeoutMs = appLock.timeoutMinutes * 60_000;

    function lockIfExpired() {
      const lastActiveAt = appLock.lastActiveAt ?? Date.now();
      if (Date.now() - lastActiveAt >= timeoutMs) {
        updateAppLock({ ...appLock, locked: true });
      }
    }

    function markActive() {
      const now = Date.now();
      if (now - appLockActivitySavedAt.current < 30_000) {
        return;
      }

      appLockActivitySavedAt.current = now;
      updateAppLock({ ...appLock, lastActiveAt: now, locked: false });
    }

    const interval = window.setInterval(lockIfExpired, 15_000);
    window.addEventListener("pointerdown", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("touchstart", markActive, { passive: true });
    window.addEventListener("visibilitychange", lockIfExpired);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointerdown", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
      window.removeEventListener("visibilitychange", lockIfExpired);
    };
  }, [appLock, settings.autoLockWallet]);

  useEffect(() => {
    const root = document.documentElement;
    const systemPrefersLight = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: light)").matches : false;
    root.dataset.theme = theme === "system" ? (systemPrefersLight ? "light" : "arc-dark") : theme;
    root.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [reducedMotion, theme]);

  function changeTab(tab: NavTab) {
    commitRoute({ tab });
    setJoinOpen(false);
    setJoinInitialCode(undefined);
  }

  function goHome() {
    commitRoute({ tab: "home" });
    setAddExpenseOpen(false);
    setJoinOpen(false);
    setJoinInitialCode(undefined);
  }

  function openGroupDetail(groupId: string, context: GroupOpenContext = {}) {
    switchActiveGroup(groupId);
    commitRoute({
      tab: "groups",
      groupId,
      expenseId: context.expenseId,
      paymentId: context.paymentId
    });
    setAddExpenseOpen(false);
  }

  function closeGroupDetail() {
    commitRoute({ tab: "groups" });
    setAddExpenseOpen(false);
  }

  function selectGroupExpense(expenseId?: string, options?: { replace?: boolean }) {
    if (!selectedGroupId) {
      return;
    }

    commitRoute(
      {
        tab: "groups",
        groupId: selectedGroupId,
        expenseId,
        paymentId: undefined
      },
      options
    );
  }

  function commitRoute(route: RouteState, options: { replace?: boolean } = {}) {
    applyRouteState(route, { switchGroup: true });
    persistRouteState(route);

    if (typeof window === "undefined") {
      return;
    }

    const path = routeToPath(route);
    if (options.replace) {
      window.history.replaceState({}, "", path);
      return;
    }

    if (`${window.location.pathname}${window.location.search}` !== path) {
      window.history.pushState({}, "", path);
    }
  }

  function applyRouteState(route: RouteState, options: { switchGroup?: boolean } = {}) {
    setActiveTab(route.tab);
    setSelectedGroupId(route.groupId ?? null);
    setSelectedExpenseId(route.expenseId);
    setSelectedPaymentId(route.paymentId);
    setAddExpenseOpen(false);

    if (options.switchGroup && route.groupId) {
      switchActiveGroup(route.groupId);
    }
  }

  function openPayment(request: PaymentRequest) {
    const result = startPayment(request);

    if (result.ok && result.paymentId) {
      setPaymentRequest(request);
      setPaymentId(result.paymentId);
      setPaymentError(undefined);
      setPaymentOpen(true);
      return undefined;
    }

    return result.message ?? "Payment could not be started.";
  }

  async function confirmPayment(id: string) {
    setPaymentBusy(true);
    setPaymentError(undefined);

    try {
      const result = await completePayment(id);

      if (!result.ok) {
        setPaymentError(result.message ?? "Payment could not be completed.");
      }

      if (primaryWallet.address) {
        try {
          const balance = await fetchArcUSDCBalance(primaryWallet.address);
          setWalletBalance(balance);
        } catch {
          setWalletBalance({ balanceUSDC: "0", balanceVND: 0 });
        }
      }
    } finally {
      setPaymentBusy(false);
    }
  }

  function openQR(mode: QRMode = "scan") {
    setQRMode(mode);
    setQROpen(true);
  }

  function openPaymentFromQR(payload: ArcNestPaymentQRPayload) {
    const group = groups.find((item) => item.id === payload.groupId);
    const fromMember = members.find((member) => member.groupId === payload.groupId && member.userId === currentUser.id && member.status === "active");
    const toMember = members.find(
      (member) => member.groupId === payload.groupId && member.walletAddress?.toLowerCase() === payload.receiverAddress.toLowerCase()
    );
    const amountVND = Math.round(Number(payload.amountUSDC) * USDC_VND_RATE);

    if (!Number.isFinite(amountVND) || amountVND <= 0) {
      return "Missing payment info";
    }

    return openPayment({
      id: payload.paymentId,
      groupId: payload.groupId,
      groupName: group?.name,
      fromMemberId: fromMember?.id,
      toMemberId: toMember?.id,
      toName: toMember?.displayName ?? "QR receiver",
      toWalletAddress: payload.receiverAddress,
      fromWalletAddress: primaryWallet.address,
      amountUSDC: payload.amountUSDC,
      amountVND,
      note: payload.note ?? group?.name ?? "QR Pay"
    });
  }

  function openInviteFromQR(payload: ArcNestInviteQRPayload) {
    setJoinInitialCode(payload.inviteCode);
    setJoinOpen(true);
    return undefined;
  }

  const ensureInviteForQR = useCallback(
    (groupId: string) => {
      const result = ensureInviteForGroup(groupId);
      return result.ok ? result.inviteCode : undefined;
    },
    [ensureInviteForGroup]
  );

  function toggleTheme() {
    setTheme(theme === "light" ? "arc-dark" : "light");
  }

  function completeOnboarding() {
    setStoredOnboardingComplete(true);
    setOnboardingComplete(true);
    setUnlockError(undefined);

    if (appLock.enabled && appLock.locked) {
      updateAppLock({ ...appLock, locked: false, lastActiveAt: Date.now() });
    }
  }

  function startDemoSession() {
    resetGroupStoreSession();
    setStoredSessionMode("demo");
    setSessionMode("demo");
    completeOnboarding();
    commitRoute({ tab: "home" }, { replace: true });
  }

  async function logout() {
    try {
      if (connection.isConnected) {
        await disconnectAsync();
      }
    } catch {
      // Local logout should still complete even if the wallet connector is already gone.
    }

    settings.disconnectAllWallets();
    resetGroupStoreSession();
    setStoredSessionMode("none");
    setSessionMode("none");
    setStoredOnboardingComplete(false);
    setOnboardingComplete(false);
    setPaymentOpen(false);
    setSendOpen(false);
    setQROpen(false);
    setSettingsOpen(false);
    commitRoute({ tab: "home" }, { replace: true });

    if (appLock.enabled) {
      updateAppLock({ ...appLock, locked: true });
    }
  }

  function resetLocalUiCache() {
    settings.resetLocalUiState();
    resetGroupStoreSession();
    setStoredSessionMode("none");
    setStoredOnboardingComplete(false);
    window.localStorage.removeItem(navStorageKey);
    window.localStorage.removeItem("arcnest-local-state-v4");
    setSessionMode("none");
    setOnboardingComplete(false);
    setSettingsOpen(false);
    commitRoute({ tab: "home" }, { replace: true });
  }

  function resetOnboarding() {
    setStoredOnboardingComplete(false);
    setOnboardingComplete(false);
    setSettingsOpen(false);
  }

  function updateAppLock(nextLock: AppLockState) {
    const normalizedLock = {
      ...nextLock,
      timeoutMinutes: normalizeAutoLockMinutes(nextLock.timeoutMinutes)
    };
    setStoredAppLockState(normalizedLock);
    setAppLock(normalizedLock);
  }

  function unlockApp(passcode: string) {
    if (!appLock.enabled || !appLock.passcodeHash) {
      completeOnboarding();
      return;
    }

    if (hashPasscode(passcode) !== appLock.passcodeHash) {
      setUnlockError("Passcode does not match.");
      return;
    }

    setStoredOnboardingComplete(true);
    setOnboardingComplete(true);
    setUnlockError(undefined);
    updateAppLock({ ...appLock, locked: false, lastActiveAt: Date.now() });
  }

  function enableAppLock(passcode: string): PasscodeResult {
    const validation = validatePasscode(passcode);
    if (!validation.ok) {
      return validation;
    }

    updateAppLock({
      enabled: true,
      passcodeHash: hashPasscode(passcode),
      locked: false,
      timeoutMinutes: appLock.timeoutMinutes || defaultAutoLockMinutes,
      lastActiveAt: Date.now()
    });
    return { ok: true, message: "App Lock enabled." };
  }

  function changeAppPasscode(currentPasscode: string, nextPasscode: string): PasscodeResult {
    if (!appLock.enabled || !appLock.passcodeHash) {
      return enableAppLock(nextPasscode);
    }

    if (hashPasscode(currentPasscode) !== appLock.passcodeHash) {
      return { ok: false, message: "Current passcode does not match." };
    }

    const validation = validatePasscode(nextPasscode);
    if (!validation.ok) {
      return validation;
    }

    updateAppLock({
      enabled: true,
      passcodeHash: hashPasscode(nextPasscode),
      locked: false,
      timeoutMinutes: appLock.timeoutMinutes || defaultAutoLockMinutes,
      lastActiveAt: Date.now()
    });
    return { ok: true, message: "Passcode changed." };
  }

  function disableAppLock(passcode: string): PasscodeResult {
    if (appLock.enabled && appLock.passcodeHash && hashPasscode(passcode) !== appLock.passcodeHash) {
      return { ok: false, message: "Passcode does not match." };
    }

    updateAppLock({
      enabled: false,
      passcodeHash: undefined,
      locked: false,
      timeoutMinutes: appLock.timeoutMinutes || defaultAutoLockMinutes,
      lastActiveAt: undefined
    });
    return { ok: true, message: "App Lock disabled." };
  }

  function setAppLockTimeoutMinutes(timeoutMinutes: number) {
    updateAppLock({
      ...appLock,
      timeoutMinutes,
      lastActiveAt: Date.now()
    });
  }

  const qrGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const qrInviteCode = qrGroup ? Object.entries(inviteCodes).find(([, groupId]) => groupId === qrGroup.id)?.[0] : undefined;
  const activePayment = paymentId ? payments.find((payment) => payment.id === paymentId) : undefined;
  const walletSessionActive = isWalletSessionActive(settings, connection);
  const entryRequired = (appLock.enabled && appLock.locked) || sessionMode === "none" || (sessionMode === "wallet" && !walletSessionActive);

  const showGlobalActions = !selectedGroupId && activeTab !== "activity";

  if (entryRequired || !onboardingComplete) {
    return (
      <div className="app-shell">
        <div className="mobile-frame">
          <WelcomeScreen
            onContinueDemo={() => {
              if (appLock.enabled && appLock.locked) {
                setUnlockError("Unlock App first, or reconnect your wallet to reset the local session.");
                return;
              }
              startDemoSession();
            }}
            appLocked={appLock.enabled && appLock.locked}
            hasLocalPasscode={Boolean(appLock.passcodeHash)}
            previousWalletAddress={settings.wallets[0]?.address}
            hasPreviousWallet={settings.wallets.length > 0}
            unlockError={unlockError}
            onUnlockApp={unlockApp}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className={["mobile-frame", showGlobalActions ? "has-global-actions" : ""].join(" ")}>
        {showGlobalActions ? (
          <GlobalHeaderActions
            syncLabel={getSyncLabel(authState, firebaseSync)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenQR={() => openQR("scan")}
          />
        ) : null}

        {selectedGroupId ? (
          <GroupDetailPage
            groupId={selectedGroupId}
            addExpenseOpen={addExpenseOpen}
            onBack={closeGroupDetail}
            onOpenAddExpense={() => setAddExpenseOpen(true)}
            onCloseAddExpense={() => setAddExpenseOpen(false)}
            onOpenQR={openQR}
            selectedExpenseId={selectedExpenseId}
            selectedPaymentId={selectedPaymentId}
            onSelectExpense={selectGroupExpense}
            onOpenPayment={openPayment}
          />
        ) : activeTab === "home" ? (
          <HomePage
            onOpenQR={openQR}
            onOpenPayment={openPayment}
            onOpenSend={() => setSendOpen(true)}
            onGoHome={goHome}
            onOpenGroup={openGroupDetail}
            onGoToSplit={() => changeTab("split")}
          />
        ) : activeTab === "groups" ? (
          <GroupsPage
            onOpenGroup={openGroupDetail}
            onCreateGroup={() => setCreateOpen(true)}
            onJoinGroup={() => {
              setJoinInitialCode(undefined);
              setJoinOpen(true);
            }}
          />
        ) : activeTab === "split" ? (
          <SplitPage onOpenPayment={openPayment} onOpenGroup={openGroupDetail} />
        ) : activeTab === "activity" ? (
          <ActivityPage onOpenGroup={openGroupDetail} />
        ) : (
          <WalletPage theme={theme} onToggleTheme={toggleTheme} onOpenQR={openQR} onOpenSend={() => setSendOpen(true)} />
        )}

        <BottomNav active={activeTab} onChange={changeTab} />
      </div>

      <CreateGroupSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGroupSheet
        open={joinOpen}
        initialCode={joinInitialCode}
        onClose={() => {
          setJoinOpen(false);
          setJoinInitialCode(undefined);
          if (extractInviteCodeFromPath(window.location.pathname)) {
            goHome();
          }
        }}
        onJoined={(groupId) => {
          if (groupId) {
            openGroupDetail(groupId);
          }
        }}
        onOpenQR={() => {
          setJoinOpen(false);
          openQR("invite");
        }}
      />
      <PaymentSheet
        open={paymentOpen}
        request={paymentRequest}
        payment={activePayment}
        walletBalanceUSDC={wallet.balanceUSDC}
        paymentMode={getArcPaymentMode()}
        paymentError={paymentError}
        confirming={paymentBusy}
        onConfirmPayment={confirmPayment}
        onMockFail={(id) => {
          setPaymentError("Demo failure was triggered for testing.");
          markPaymentFailed(id);
        }}
        onRetry={(id) => {
          setPaymentError(undefined);
          retryPayment(id);
        }}
        onClose={() => setPaymentOpen(false)}
      />
      <SendSheet
        open={sendOpen}
        fromWalletAddress={primaryWallet.address}
        activeGroupId={activeGroupId || undefined}
        activeGroupName={groups.find((group) => group.id === activeGroupId)?.name}
        onSubmit={openPayment}
        onClose={() => setSendOpen(false)}
      />
      <QRPaySheet
        open={qrOpen}
        mode={qrMode}
        primaryWalletAddress={primaryWallet.address}
        activeGroupId={qrGroup?.id ?? activeGroupId}
        activeGroupName={qrGroup?.name}
        inviteCode={qrInviteCode}
        onPaymentPayload={openPaymentFromQR}
        onInvitePayload={openInviteFromQR}
        onEnsureInvite={ensureInviteForQR}
        onClose={() => setQROpen(false)}
      />
      <SettingsSheet
        open={settingsOpen}
        wallet={wallet}
        appLockEnabled={appLock.enabled}
        appLockTimeoutMinutes={appLock.timeoutMinutes}
        firebaseUid={authState.profile?.id}
        userKey={currentUser.id}
        syncLabel={getSyncLabel(authState, firebaseSync)}
        lastSyncAt={Date.now()}
        onLogout={() => void logout()}
        onResetLocalUiCache={resetLocalUiCache}
        onEnableAppLock={enableAppLock}
        onChangeAppPasscode={changeAppPasscode}
        onDisableAppLock={disableAppLock}
        onSetAppLockTimeout={setAppLockTimeoutMinutes}
        onClose={() => setSettingsOpen(false)}
        onResetOnboarding={resetOnboarding}
      />
    </div>
  );
}

function getStoredOnboardingComplete() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(onboardingStorageKey) === "true";
}

function setStoredOnboardingComplete(complete: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (complete) {
    window.localStorage.setItem(onboardingStorageKey, "true");
    return;
  }

  window.localStorage.removeItem(onboardingStorageKey);
}

function getStoredSessionMode(): SessionMode {
  if (typeof window === "undefined") {
    return "none";
  }

  const value = window.localStorage.getItem(sessionStorageKey);
  return value === "wallet" || value === "demo" ? value : "none";
}

function setStoredSessionMode(mode: SessionMode) {
  if (typeof window === "undefined") {
    return;
  }

  if (mode === "none") {
    window.localStorage.removeItem(sessionStorageKey);
    return;
  }

  window.localStorage.setItem(sessionStorageKey, mode);
}

function isWalletSessionActive(settings: ReturnType<typeof useSettingsStore>, connection?: ReturnType<typeof useConnection>) {
  const walletAddress = settings.primaryWallet.address.toLowerCase();
  const settingsActive = settings.walletConnected && settings.primaryWallet.status === "active" && Boolean(walletAddress);

  if (!settingsActive || !connection) {
    return settingsActive;
  }

  return Boolean(connection.isConnected && connection.address && connection.address.toLowerCase() === walletAddress);
}

function getInitialRouteState(): RouteState {
  if (typeof window === "undefined") {
    return { tab: "home" };
  }

  const routeFromUrl = getRouteStateFromUrl();
  const hasRoutePath = window.location.pathname !== "/" && !extractInviteCodeFromPath(window.location.pathname);

  if (hasRoutePath || window.location.search) {
    return routeFromUrl;
  }

  return getStoredRouteState() ?? routeFromUrl;
}

function getRouteStateFromUrl(): RouteState {
  if (typeof window === "undefined") {
    return { tab: "home" };
  }

  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(window.location.search);
  const expenseId = params.get("expense") || undefined;
  const paymentId = params.get("payment") || undefined;
  const groupMatch = path.match(/^\/groups\/([^/]+)$/);

  if (groupMatch?.[1]) {
    return {
      tab: "groups",
      groupId: decodeURIComponent(groupMatch[1]),
      expenseId,
      paymentId
    };
  }

  if (path === "/groups") {
    return { tab: "groups" };
  }

  if (path === "/split") {
    return { tab: "split", paymentId };
  }

  if (path === "/activity") {
    return { tab: "activity", paymentId };
  }

  if (path === "/wallet") {
    return { tab: "wallet" };
  }

  return { tab: "home" };
}

function routeToPath(route: RouteState) {
  const params = new URLSearchParams();

  if (route.expenseId) {
    params.set("expense", route.expenseId);
  }

  if (route.paymentId) {
    params.set("payment", route.paymentId);
  }

  const query = params.toString();
  const suffix = query ? `?${query}` : "";

  if (route.groupId) {
    return `/groups/${encodeURIComponent(route.groupId)}${suffix}`;
  }

  if (route.tab === "home") {
    return `/${suffix}`;
  }

  return `/${route.tab}${suffix}`;
}

function persistRouteState(route: RouteState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(navStorageKey, JSON.stringify(route));
}

function getStoredRouteState() {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const raw = window.localStorage.getItem(navStorageKey);
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as Partial<RouteState>;
    if (!parsed.tab || !["home", "groups", "split", "activity", "wallet"].includes(parsed.tab)) {
      return undefined;
    }

    return parsed as RouteState;
  } catch {
    return undefined;
  }
}

function getStoredAppLockState(): AppLockState {
  if (typeof window === "undefined") {
    return { enabled: false, locked: false, timeoutMinutes: defaultAutoLockMinutes };
  }

  try {
    const raw = window.localStorage.getItem(appLockStorageKey);
    if (!raw) {
      return { enabled: false, locked: false, timeoutMinutes: defaultAutoLockMinutes };
    }

    const parsed = JSON.parse(raw) as Partial<AppLockState>;
    const enabled = Boolean(parsed.enabled && parsed.passcodeHash);
    const timeoutMinutes = normalizeAutoLockMinutes(parsed.timeoutMinutes);
    const lastActiveAt = typeof parsed.lastActiveAt === "number" ? parsed.lastActiveAt : Date.now();
    const timedOut = enabled && Date.now() - lastActiveAt >= timeoutMinutes * 60_000;

    return {
      enabled,
      passcodeHash: typeof parsed.passcodeHash === "string" ? parsed.passcodeHash : undefined,
      locked: Boolean(enabled && (parsed.locked || timedOut)),
      timeoutMinutes,
      lastActiveAt
    };
  } catch {
    return { enabled: false, locked: false, timeoutMinutes: defaultAutoLockMinutes };
  }
}

function setStoredAppLockState(lock: AppLockState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(appLockStorageKey, JSON.stringify(lock));
}

function validatePasscode(passcode: string): PasscodeResult {
  if (passcode.trim().length < 4) {
    return { ok: false, message: "Use at least 4 digits or characters." };
  }

  return { ok: true };
}

function normalizeAutoLockMinutes(value: unknown) {
  return typeof value === "number" && [5, 10, 15, 20, 30, 45, 60].includes(value) ? value : defaultAutoLockMinutes;
}

function hashPasscode(passcode: string) {
  const source = `arcnest-local-lock:${passcode}`;
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function getInitialInviteCode() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return extractInviteCodeFromPath(window.location.pathname);
}

function getSyncLabel(authState: ReturnType<typeof useAuthStore>, groupSync: ReturnType<typeof useGroupStore>["firebaseSync"]) {
  if (authState.mode === "local") {
    return "Local";
  }

  if (authState.loading || groupSync.loading) {
    return "Syncing";
  }

  if (authState.error || groupSync.error) {
    return "Sync issue";
  }

  return "Synced";
}
