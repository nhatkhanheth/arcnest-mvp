import { CheckCircle2, TriangleAlert, Wallet } from "lucide-react";

type PaymentStatusProps = {
  state: "success" | "insufficient" | "failed";
};

export function PaymentStatus({ state }: PaymentStatusProps) {
  if (state === "success") {
    return (
      <div className="rounded-[22px] border border-[var(--success)]/40 bg-[var(--success)]/10 p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success)]/20 text-[var(--success)]">
          <CheckCircle2 size={28} />
        </div>
        <h3 className="mt-4 font-display text-xl font-bold">Payment Successful</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">The payment is complete and balances are updated.</p>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="rounded-[22px] border border-[var(--danger)]/45 bg-[var(--danger)]/10 p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--danger)]/20 text-[var(--danger)]">
          <TriangleAlert size={28} />
        </div>
        <h3 className="mt-4 font-display text-xl font-bold">Payment failed</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">The transfer failed. Retry keeps balances unchanged until paid.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-[var(--warning)]/45 bg-[var(--warning)]/10 p-5 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--warning)]/20 text-[var(--warning)]">
        <Wallet size={28} />
      </div>
      <h3 className="mt-4 font-display text-xl font-bold">Not enough USDC</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Add funds or lower the payment amount before trying again.</p>
    </div>
  );
}
