import { QrCode } from "lucide-react";
import { Button } from "../ui/Button";

type QRPayButtonProps = {
  onClick: () => void;
  label?: string;
};

export function QRPayButton({ onClick, label = "QR Pay" }: QRPayButtonProps) {
  return <Button icon={<QrCode size={19} />} onClick={onClick}>{label}</Button>;
}
