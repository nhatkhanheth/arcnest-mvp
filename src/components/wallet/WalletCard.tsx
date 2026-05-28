import { ArrowDownLeft, ArrowUpRight, QrCode } from "lucide-react";
import type { Wallet } from "../../models";
import { formatUSDC, formatVND } from "../../lib/format";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NetworkBadge } from "./NetworkBadge";

type WalletCardProps = {
  wallet: Wallet;
  onSend: () => void;
  onReceive: () => void;
  onScanQR?: () => void;
};

export function WalletCard({ wallet, onSend, onReceive, onScanQR }: WalletCardProps) {
  return (
    <Card className="overflow-hidden">
      <div>
        <p className="text-sm font-medium text-[var(--text-muted)]">Total balance</p>
        <h1 className="number mt-3 text-[40px] font-bold leading-none">{formatUSDC(wallet.balanceUSDC).replace(" USDC", "")}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span>USDC</span>
          <span className="h-1 w-1 rounded-full bg-[var(--text-muted)]" />
          <span>{formatVND(wallet.balanceVND)}</span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <NetworkBadge />
        <span className="text-xs font-medium text-[var(--text-muted)]">Arc wallet</span>
      </div>
      <div className={["mt-5 grid gap-3", onScanQR ? "grid-cols-3" : "grid-cols-2"].join(" ")}>
        <Button variant="muted" size="md" icon={<ArrowUpRight size={18} />} onClick={onSend}>
          Send
        </Button>
        <Button variant="muted" size="md" icon={<ArrowDownLeft size={18} />} onClick={onReceive}>
          Receive
        </Button>
        {onScanQR ? (
          <Button variant="muted" size="md" icon={<QrCode size={18} />} onClick={onScanQR}>
            QR
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
