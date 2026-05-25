import { useState, type ReactNode } from "react";
import { CheckCircle2, ExternalLink, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useConnection, useSwitchChain } from "wagmi";
import type { Payment, PaymentRequest } from "../../models";
import type { ArcPaymentMode } from "../../lib/arc";
import { arcNetwork, getArcExplorerTxUrl, getFriendlyWalletError, isWrongArcNetwork, requestSwitchArcTestnet } from "../../lib/arc";
import { formatUSDC, formatVND, shortAddress } from "../../lib/format";
import { Button } from "../ui/Button";
import { BottomSheet } from "../ui/Modal";
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
  const insufficient = request ? Number(request.amountUSDC) > Number(walletBalanceUSDC) : false;

  if (!request || !payment) {
    return null;
  }

  const paid = payment.status === "paid";
  const pending = payment.status === "pending";
  const failed = payment.status === "failed";
  const cancelled = payment.status === "cancelled";
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const wrongNetwork = paymentMode === "testnet" && connection.isConnected && isWrongArcNetwork(connection.chainId);
  const needsWallet = paymentMode === "testnet" && !connection.isConnected;
  const explorerTxUrl = payment.txHash ? getArcExplorerTxUrl(payment.txHash) : undefined;
  const title = paid ? "Payment complete" : pending ? "Payment pending" : failed ? "Payment failed" : cancelled ? "Payment cancelled" : "Pay with USDC";
  const subtitle = paymentMode === "testnet" ? "Testnet payment" : "Demo payment";
  const confirmLabel = confirming
    ? "Confirming"
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

    try {
      if (connection.isConnected) {
        await switchChainAsync({ chainId: arcNetwork.chainId });
        return;
      }

      await requestSwitchArcTestnet();
    } catch (error) {
      try {
        await requestSwitchArcTestnet();
      } catch (fallbackError) {
        setNetworkError(getFriendlyWalletError(fallbackError || error));
      }
    }
  }

  return (
    <BottomSheet open={open} title={title} subtitle={subtitle} onClose={onClose}>
      <div className="space-y-4">
        {paid ? (
          <>
            <PaymentStatus state="success" />
            {payment.txHash ? <Detail label={paymentMode === "testnet" ? "Tx hash" : "Demo tx"} value={shortAddress(payment.txHash)} /> : null}
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
            {payment.txHash ? <Detail label={paymentMode === "testnet" ? "Tx hash" : "Demo tx"} value={shortAddress(payment.txHash)} /> : null}
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
              <Detail label="From wallet" value={shortAddress(request.fromWalletAddress)} />
              <Detail label="To wallet" value={shortAddress(request.toWalletAddress)} supporting={request.toName} />
              <Detail label="Network" value={missingConfig ? "Missing config" : paymentMode === "testnet" ? "Arc testnet" : "Demo mode"} icon={<ShieldCheck size={16} />} />
              <Detail label="Status" value={payment.status === "pending" ? "Pending signature" : payment.status} />
              <Detail label="For" value={request.note ?? request.groupName ?? "ArcNest payment"} />
            </div>
            {wrongNetwork ? (
              <div className="space-y-3">
                <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">
                  Switch your wallet to Arc Testnet before confirming.
                </div>
                <Button fullWidth variant="secondary" icon={<RotateCcw size={18} />} onClick={() => void switchNetwork()}>
                  Switch to Arc Testnet
                </Button>
              </div>
            ) : null}
            {networkError ? <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">{networkError}</div> : null}
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
            {payment.txHash ? <Detail label="Submitted tx" value={shortAddress(payment.txHash)} /> : null}
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
  icon
}: {
  label: string;
  value: string;
  supporting?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="surface-row flex min-h-[58px] items-center justify-between gap-4 rounded-[18px] px-4">
      <span className="text-sm text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 text-right">
        <span className="flex items-center justify-end gap-1.5 font-semibold">
          {icon}
          {value}
        </span>
        {supporting ? <span className="block text-xs text-[var(--text-muted)]">{supporting}</span> : null}
      </span>
    </div>
  );
}
