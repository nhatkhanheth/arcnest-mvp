import { useCallback, useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Copy, ExternalLink, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useConnection, useSwitchChain } from "wagmi";
import type { Payment, PaymentRequest } from "../../models";
import type { ArcPaymentMode } from "../../lib/arc";
import { arcNetwork, getArcExplorerTxUrl, isWrongArcNetwork, readArcNetworkSnapshot, switchArcTestnetWithFallback } from "../../lib/arc";
import { CIRCLE_FAUCET_URL } from "../../lib/appMeta";
import { formatUSDC, formatVND, shortAddress } from "../../lib/format";
import { useClipboardToast } from "../../hooks/useClipboardToast";
import { Button } from "../ui/Button";
import { CopyToast } from "../ui/CopyToast";
import { BottomSheet } from "../ui/Modal";
import { ArcNetworkManualSetup } from "../wallet/ArcNetworkManualSetup";
import { PaymentStatus } from "./PaymentStatus";

type PaymentSheetProps = {
  open: boolean;
  request?: PaymentRequest;
  payment?: Payment;
  walletBalanceUSDC: string;
  paymentMode: ArcPaymentMode;
  paymentError?: string;
  confirming?: boolean;
  onClose: () => void;
  onConfirmPayment: (paymentId: string) => Promise<void> | void;
  onMockFail: (paymentId: string) => void;
  onRetry: (paymentId: string) => void;
};

export function PaymentSheet({
  open,
  request,
  payment,
  walletBalanceUSDC,
  paymentMode,
  paymentError,
  confirming,
  onClose,
  onConfirmPayment,
  onMockFail,
  onRetry
}: PaymentSheetProps) {
  const connection = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const [networkError, setNetworkError] = useState<string>();
  const [networkStatus, setNetworkStatus] = useState<string>();
  const [manualSetupRequired, setManualSetupRequired] = useState(false);
  const [verifiedChainId, setVerifiedChainId] = useState<number>();
  const { toastMessage, copyWithToast } = useClipboardToast();

  const clearArcNetworkErrors = useCallback(() => {
    setNetworkError(undefined);
    setManualSetupRequired(false);
    setNetworkStatus(undefined);
  }, []);

  const refreshVerifiedNetwork = useCallback(async () => {
    const snapshot = await readArcNetworkSnapshot(connection.connector);

    if (snapshot.chainId) {
      setVerifiedChainId(snapshot.chainId);
    }

    if (snapshot.isArc) {
      clearArcNetworkErrors();
    }

    return snapshot;
  }, [clearArcNetworkErrors, connection.connector]);

  useEffect(() => {
    setVerifiedChainId(connection.chainId);

    if (connection.chainId === arcNetwork.chainId) {
      clearArcNetworkErrors();
    }
  }, [clearArcNetworkErrors, connection.address, connection.chainId]);

  useEffect(() => {
    if (!open || !connection.isConnected) {
      return;
    }

    function handleAppReturn() {
      void refreshVerifiedNetwork();
    }

    window.addEventListener("focus", handleAppReturn);
    window.addEventListener("pageshow", handleAppReturn);
    window.addEventListener("online", handleAppReturn);
    document.addEventListener("visibilitychange", handleAppReturn);

    return () => {
      window.removeEventListener("focus", handleAppReturn);
      window.removeEventListener("pageshow", handleAppReturn);
      window.removeEventListener("online", handleAppReturn);
      document.removeEventListener("visibilitychange", handleAppReturn);
    };
  }, [connection.isConnected, open, refreshVerifiedNetwork]);

  if (!request || !payment) {
    return null;
  }

  const insufficient = Number(request.amountUSDC) > Number(walletBalanceUSDC);
  const paid = payment.status === "paid";
  const pending = payment.status === "pending";
  const failed = payment.status === "failed";
  const cancelled = payment.status === "cancelled";
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const effectiveChainId = verifiedChainId ?? connection.chainId;
  const isArcTestnet = effectiveChainId === arcNetwork.chainId;
  const wrongNetwork = paymentMode === "testnet" && connection.isConnected && isWrongArcNetwork(effectiveChainId);
  const needsWallet = paymentMode === "testnet" && !connection.isConnected;
  const explorerTxUrl = payment.txHash ? getArcExplorerTxUrl(payment.txHash) : undefined;
  const payerWalletAddress = request.fromWalletAddress;
  const title = paid ? "Payment complete" : pending ? "Payment pending" : failed ? "Payment failed" : cancelled ? "Payment cancelled" : "Pay with USDC";
  const subtitle = paymentMode === "testnet" ? "Testnet payment" : "Demo payment";
  const confirmLabel = confirming
    ? "Confirming"
    : networkStatus
      ? "Switching network"
      : wrongNetwork
        ? "Wrong network"
        : needsWallet
          ? "Connect wallet"
          : missingConfig
            ? "Demo payment"
            : paymentMode === "testnet"
              ? "Pay on Arc Testnet"
              : "Demo payment";

  async function switchNetwork() {
    setNetworkError(undefined);
    setManualSetupRequired(false);
    setNetworkStatus("Switching network...");

    try {
      const result = await switchArcTestnetWithFallback({
        connector: connection.connector,
        switchChain: connection.isConnected ? () => switchChainAsync({ chainId: arcNetwork.chainId }) : undefined
      });

      if (result.ok) {
        setVerifiedChainId(result.chainId ?? arcNetwork.chainId);
        clearArcNetworkErrors();
        setNetworkStatus("Arc Testnet connected.");
        window.setTimeout(() => setNetworkStatus(undefined), 1200);
        return;
      }

      const refreshed = await pollForArcNetwork(refreshVerifiedNetwork);

      if (refreshed) {
        setNetworkStatus("Arc Testnet connected.");
        window.setTimeout(() => setNetworkStatus(undefined), 1200);
        return;
      }

      setNetworkStatus(undefined);
      setNetworkError(result.message);
      setManualSetupRequired(result.reason === "manual");
    } catch (error) {
      setNetworkStatus(undefined);
      setNetworkError(error instanceof Error ? error.message : "Network switch could not be completed.");
    }
  }

  function copyPaymentWalletAddress() {
    void copyWithToast(payerWalletAddress, "Address copied");
  }

  return (
    <BottomSheet open={open} title={title} subtitle={subtitle} onClose={onClose}>
      <CopyToast message={toastMessage} />
      <div className="space-y-4">
        {paid ? (
          <>
            <PaymentStatus state="success" />
            {payment.txHash ? (
              <Detail
                label={paymentMode === "testnet" ? "Tx hash" : "Demo tx"}
                value={shortAddress(payment.txHash)}
                onCopy={() => void copyWithToast(payment.txHash, "Transaction hash copied")}
              />
            ) : null}
            {paymentMode === "testnet" && explorerTxUrl ? (
              <a
                className="surface-row focus-ring flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
                href={explorerTxUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on explorer
                <ExternalLink size={16} />
              </a>
            ) : null}
            <Button fullWidth variant="secondary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : pending ? (
          <>
            <PaymentStatus state="pending" />
            {payment.txHash ? (
              <Detail
                label={paymentMode === "testnet" ? "Tx hash" : "Demo tx"}
                value={shortAddress(payment.txHash)}
                onCopy={() => void copyWithToast(payment.txHash, "Transaction hash copied")}
              />
            ) : null}
            {paymentMode === "testnet" && explorerTxUrl ? (
              <a
                className="surface-row focus-ring flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] px-4 text-sm font-semibold"
                href={explorerTxUrl}
                target="_blank"
                rel="noreferrer"
              >
                View on explorer
                <ExternalLink size={16} />
              </a>
            ) : null}
            <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
              Waiting for confirmation. This payment is locked so it cannot be paid twice.
            </div>
            <Button fullWidth variant="secondary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : failed ? (
          <>
            <PaymentStatus state="failed" />
            {paymentError ? <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">{paymentError}</div> : null}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
              <Button icon={<RotateCcw size={18} />} onClick={() => onRetry(payment.id)}>
                Retry
              </Button>
            </div>
          </>
        ) : cancelled ? (
          <>
            <div className="rounded-[22px] border border-[var(--danger)]/45 bg-[var(--danger)]/10 p-5 text-center">
              <h3 className="font-display text-xl font-bold">Payment cancelled</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">This payment cannot be paid again from the same record.</p>
            </div>
            <Button fullWidth variant="secondary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : insufficient ? (
          <>
            <PaymentStatus state="insufficient" />
            <div className="surface-row space-y-3 rounded-[18px] p-3">
              <div>
                <p className="text-sm font-semibold">Need test USDC?</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Copy your wallet address, then paste it into Circle Faucet. Testnet only.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" icon={<Copy size={18} />} onClick={copyPaymentWalletAddress}>
                  Copy address
                </Button>
                <a
                  className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[18px] border border-[var(--border-soft)] bg-[var(--row-bg)] px-4 text-sm font-semibold text-[var(--text-primary)] transition active:scale-[0.98]"
                  href={CIRCLE_FAUCET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Faucet
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
            <Button fullWidth variant="secondary" onClick={onClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <div className="surface-row rounded-[22px] p-5">
              <p className="text-xs font-semibold text-[var(--text-muted)]">Amount</p>
              <p className="number mt-2 text-3xl font-bold">{formatUSDC(request.amountUSDC)}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatVND(request.amountVND)}</p>
            </div>
            <div className="space-y-2">
              <Detail label="From wallet" value={shortAddress(request.fromWalletAddress)} onCopy={() => void copyWithToast(request.fromWalletAddress, "Sender address copied")} />
              <Detail label="To wallet" value={shortAddress(request.toWalletAddress)} supporting={request.toName} onCopy={() => void copyWithToast(request.toWalletAddress, "Receiver address copied")} />
              <Detail label="Network" value={missingConfig ? "Missing config" : paymentMode === "testnet" ? "Arc testnet" : "Demo mode"} icon={<ShieldCheck size={16} />} />
              <Detail label="Status" value={payment.status === "pending" ? "Pending signature" : payment.status} />
              <Detail label="For" value={request.note ?? request.groupName ?? "ArcNest payment"} />
            </div>
            {wrongNetwork ? (
              <div className="space-y-3">
                <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">
                  Switch your wallet to Arc Testnet before confirming.
                </div>
                <Button fullWidth variant="secondary" icon={<RotateCcw size={18} />} onClick={() => void switchNetwork()} disabled={Boolean(networkStatus)}>
                  {networkStatus ? "Switching network..." : "Switch to Arc Testnet"}
                </Button>
              </div>
            ) : null}
            {networkStatus ? <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">{networkStatus}</div> : null}
            {networkError ? <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">{networkError}</div> : null}
            {manualSetupRequired && !isArcTestnet ? <ArcNetworkManualSetup /> : null}
            {needsWallet ? (
              <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
                Connect a test wallet before sending a testnet payment.
              </div>
            ) : null}
            {missingConfig ? (
              <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
                Demo payment - no onchain transaction will be sent.
              </div>
            ) : null}
            {!missingConfig && !wrongNetwork && !needsWallet ? (
              <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
                Testnet payment - transaction will be sent. Use a new test wallet only.
              </div>
            ) : null}
            <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
              Never enter a seed phrase or private key in ArcNest. Do not use real funds.
            </div>
            {paymentError ? <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">{paymentError}</div> : null}
            {payment.txHash ? <Detail label="Submitted tx" value={shortAddress(payment.txHash)} onCopy={() => void copyWithToast(payment.txHash, "Transaction hash copied")} /> : null}
            <Button fullWidth size="lg" icon={<CheckCircle2 size={18} />} onClick={() => void onConfirmPayment(payment.id)} disabled={confirming || wrongNetwork || needsWallet || payment.status !== "unpaid"}>
              {confirmLabel}
            </Button>
            {paymentMode === "mock" ? (
              <Button fullWidth variant="secondary" icon={<TriangleAlert size={18} />} onClick={() => onMockFail(payment.id)} disabled={confirming}>
                Demo failure
              </Button>
            ) : null}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function Detail({
  label,
  value,
  supporting,
  icon,
  onCopy
}: {
  label: string;
  value: string;
  supporting?: string;
  icon?: ReactNode;
  onCopy?: () => void;
}) {
  return (
    <div className="surface-row flex min-h-[58px] items-center justify-between gap-4 rounded-[18px] px-4">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-right">
        <span className="min-w-0">
          <span className="flex items-center justify-end gap-1.5 font-semibold">
            {icon}
            <span className="truncate">{value}</span>
          </span>
          {supporting ? <span className="block truncate text-xs text-[var(--text-muted)]">{supporting}</span> : null}
        </span>
        {onCopy ? (
          <button
            type="button"
            aria-label={`Copy ${label}`}
            className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[var(--border-soft)] text-[var(--text-muted)]"
            onClick={onCopy}
          >
            <Copy size={14} />
          </button>
        ) : null}
      </span>
    </div>
  );
}

async function pollForArcNetwork(refresh: () => Promise<{ isArc: boolean }>) {
  const delays = [0, 500, 1000, 2000, 3000, 5000];

  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }

    const snapshot = await refresh();
    if (snapshot.isArc) {
      return true;
    }
  }

  return false;
}
