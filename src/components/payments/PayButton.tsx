import { CreditCard } from "lucide-react";
import { useConnection } from "wagmi";
import type { Payment } from "../../models";
import { arcNetwork, getArcPaymentMode, isWrongArcNetwork } from "../../lib/arc";
import { Button } from "../ui/Button";

type PayButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  status?: Payment["status"];
};

export function PayButton({ onClick, disabled, status = "unpaid" }: PayButtonProps) {
  const connection = useConnection();
  const paymentMode = getArcPaymentMode();
  const wrongNetwork = paymentMode === "testnet" && connection.isConnected && isWrongArcNetwork(connection.chainId);
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const label =
    status === "pending"
      ? "Pending"
      : status === "paid"
        ? "Paid"
        : status === "failed"
          ? "Retry"
          : status === "cancelled"
            ? "Cancelled"
            : wrongNetwork
              ? "Wrong network"
              : missingConfig
                ? "Demo payment"
                : paymentMode === "testnet"
                  ? "Arc Testnet"
                  : "Demo payment";
  const locked = status === "pending" || status === "paid" || status === "cancelled";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" icon={<CreditCard size={16} />} onClick={onClick} disabled={disabled || locked} title={missingConfig ? "Missing config. Demo payment mode is active." : label}>
        {label}
      </Button>
      {missingConfig && !wrongNetwork ? <span className="text-[11px] font-semibold text-[var(--warning)]">Missing config</span> : null}
    </span>
  );
}
