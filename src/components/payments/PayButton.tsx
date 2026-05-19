import { CreditCard } from "lucide-react";
import { Button } from "../ui/Button";

type PayButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function PayButton({ onClick, disabled }: PayButtonProps) {
  return (
    <Button size="sm" icon={<CreditCard size={16} />} onClick={onClick} disabled={disabled}>
      Pay
    </Button>
  );
}
