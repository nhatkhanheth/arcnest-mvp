import { CreditCard } from "lucide-react";
import { useConnection } from "wagmi";
import { arcNetwork, getArcPaymentMode, isWrongArcNetwork } from "../../lib/arc";
import { Button } from "../ui/Button";

type PayButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function PayButton({ onClick, disabled }: PayButtonProps) {
  const connection = useConnection();
  const paymentMode = getArcPaymentMode();
  const wrongNetwork = paymentMode === "testnet" && connection.isConnected && isWrongArcNetwork(connection.chainId);
  const missingConfig = arcNetwork.missingPaymentEnvVars.length > 0;
  const label = wrongNetwork ? "Wrong network" : missingConfig ? "Demo payment" : paymentMode === "testnet" ? "Testnet payment" : "Demo payment";

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" icon={<CreditCard size={16} />} onClick={onClick} disabled={disabled || wrongNetwork} title={missingConfig ? "Missing config. Demo payment mode is active." : label}>
        {label}
      </Button>
      {missingConfig && !wrongNetwork ? <span className="text-[11px] font-semibold text-[var(--warning)]">Missing config</span> : null}
    </span>
  );
}
