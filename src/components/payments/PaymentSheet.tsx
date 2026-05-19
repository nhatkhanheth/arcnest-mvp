import type { ReactNode } from "react";
import { CheckCircle2, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Payment, PaymentRequest } from "../../models";
import type { ArcPaymentMode } from "../../lib/arc";
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
  const insufficient = request ? Number(request.amountUSDC) > Number(walletBalanceUSDC) : false;

  if (!request || !payment) {
    return null;
  }

  const paid = payment.status === "paid";
  const failed = payment.status === "failed";
  const title = paid ? "Payment complete" : failed ? "Payment failed" : "Pay with USDC";
  const subtitle = paymentMode === "real" ? "Signed USDC payment" : "Demo payment mode";

  return (
    <BottomSheet open={open} title={title} subtitle={subtitle} onClose={onClose}>
      <div className="space-y-4">
        {paid ? (
          <>
            <PaymentStatus state="success" />
            {payment.txHash ? <Detail label={paymentMode === "real" ? "Tx hash" : "Mock tx"} value={shortAddress(payment.txHash)} /> : null}
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
              <Detail label="Network" value="Arc" icon={<ShieldCheck size={16} />} />
              <Detail label="Status" value={payment.status === "pending" ? "Pending signature" : payment.status} />
              <Detail label="For" value={request.note ?? request.groupName ?? "ArcNest payment"} />
            </div>
            {paymentError ? <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">{paymentError}</div> : null}
            <Button fullWidth size="lg" icon={<CheckCircle2 size={18} />} onClick={() => void onConfirmPayment(payment.id)} disabled={confirming}>
              {confirming ? "Confirming" : paymentMode === "real" ? "Confirm payment" : "Confirm demo payment"}
            </Button>
            {paymentMode === "mock" ? (
              <Button fullWidth variant="secondary" icon={<TriangleAlert size={18} />} onClick={() => onMockFail(payment.id)} disabled={confirming}>
                Mock failure
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
