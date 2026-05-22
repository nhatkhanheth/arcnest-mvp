import { useCallback, useEffect, useRef, useState } from "react";
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
import { connectGroupStoreToFirebase } from "../state/useGroupStore";
import { startAuthStore, useAuthStore } from "../state/useAuthStore";
import { useSettingsStore } from "../state/useSettingsStore";
import { connectSettingsStoreToFirebase } from "../state/useSettingsStore";
import { fetchArcUSDCBalance } from "../services/arcBalanceService";
import { USDC_VND_RATE } from "../services/balanceService";

type QRMode = "scan" | "myqr" | "payload" | "invite";
const onboardingStorageKey = "arcnest_onboarding_completed";

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
  const { theme, setTheme, reducedMotion, primaryWallet } = useSettingsStore();
  const [activeTab, setActiveTab] = useState<NavTab>("home");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
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
  const pendingInviteCode = useRef<string | undefined>(getInitialInviteCode());

  useEffect(() => {
    startAuthStore();
  }, []);

  useEffect(() => {
    connectGroupStoreToFirebase(authState.profile);
    connectSettingsStoreToFirebase(authState.profile);
  }, [authState.profile]);

  useEffect(() => {
    if (!primaryWallet.address) {
      setWalletBalance({ balanceUSDC: "0", balanceVND: 0 });
      return;
    }

    setPrimaryWalletAddress(primaryWallet.address);
  }, [primaryWallet.address, setPrimaryWalletAddress, setWalletBalance]);

  useEffect(() => {
    if (!primaryWallet.address) {
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
  }, [primaryWallet.address, setWalletBalance]);

  useEffect(() => {
    if (!onboardingComplete || !pendingInviteCode.current) {
      return;
    }

    setJoinInitialCode(pendingInviteCode.current);
    setJoinOpen(true);
    pendingInviteCode.current = undefined;
  }, [onboardingComplete]);

  useEffect(() => {
    const root = document.documentElement;
    const systemPrefersLight = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: light)").matches : false;
    root.dataset.theme = theme === "system" ? (systemPrefersLight ? "light" : "arc-dark") : theme;
    root.dataset.motion = reducedMotion ? "reduced" : "full";
  }, [reducedMotion, theme]);

  function changeTab(tab: NavTab) {
    setActiveTab(tab);
    setSelectedGroupId(null);
    setAddExpenseOpen(false);
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
  }

  function resetOnboarding() {
    setStoredOnboardingComplete(false);
    setOnboardingComplete(false);
    setSettingsOpen(false);
  }

  const selectedGroup = selectedGroupId ? groups.find((group) => group.id === selectedGroupId) : undefined;
  const qrGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
  const qrInviteCode = qrGroup ? Object.entries(inviteCodes).find(([, groupId]) => groupId === qrGroup.id)?.[0] : undefined;
  const activePayment = paymentId ? payments.find((payment) => payment.id === paymentId) : undefined;

  const showGlobalActions = !selectedGroup && activeTab !== "activity";

  if (!onboardingComplete) {
    return (
      <div className="app-shell">
        <div className="mobile-frame">
          <WelcomeScreen onContinueDemo={completeOnboarding} onComplete={completeOnboarding} />
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

        {selectedGroup ? (
          <GroupDetailPage
            groupId={selectedGroup.id}
            addExpenseOpen={addExpenseOpen}
            onBack={() => setSelectedGroupId(null)}
            onOpenAddExpense={() => setAddExpenseOpen(true)}
            onCloseAddExpense={() => setAddExpenseOpen(false)}
            onOpenQR={openQR}
          />
        ) : activeTab === "home" ? (
          <HomePage onOpenQR={openQR} onOpenPayment={openPayment} onOpenSend={() => setSendOpen(true)} onGoToSplit={() => changeTab("split")} />
        ) : activeTab === "groups" ? (
          <GroupsPage
            onOpenGroup={(groupId) => {
              switchActiveGroup(groupId);
              setSelectedGroupId(groupId);
            }}
            onCreateGroup={() => setCreateOpen(true)}
            onJoinGroup={() => {
              setJoinInitialCode(undefined);
              setJoinOpen(true);
            }}
          />
        ) : activeTab === "split" ? (
          <SplitPage onOpenPayment={openPayment} />
        ) : activeTab === "activity" ? (
          <ActivityPage />
        ) : (
          <WalletPage theme={theme} onToggleTheme={toggleTheme} onOpenQR={openQR} onOpenSend={() => setSendOpen(true)} />
        )}

        <BottomNav active={activeTab} onChange={changeTab} />
      </div>

      <CreateGroupSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinGroupSheet
        open={joinOpen}
        initialCode={joinInitialCode}
        onClose={() => setJoinOpen(false)}
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
      <SettingsSheet open={settingsOpen} wallet={wallet} onClose={() => setSettingsOpen(false)} onResetOnboarding={resetOnboarding} />
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
