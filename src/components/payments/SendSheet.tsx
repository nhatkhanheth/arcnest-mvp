import { useEffect, useState } from "react";
import { ArrowUpRight, ClipboardPaste } from "lucide-react";
import { isAddress } from "viem";
import type { PaymentRequest } from "../../models";
import { USDC_VND_RATE } from "../../services/balanceService";
import { Button } from "../ui/Button";
import { Input, TextArea } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";

type SendSheetProps = {
  open: boolean;
  fromWalletAddress: string;
  activeGroupId?: string;
  activeGroupName?: string;
  onClose: () => void;
  onSubmit: (request: PaymentRequest) => string | undefined | void;
};

export function SendSheet({ open, fromWalletAddress, activeGroupId, activeGroupName, onClose, onSubmit }: SendSheetProps) {
  const [toWalletAddress, setToWalletAddress] = useState("");
  const [amountUSDC, setAmountUSDC] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(undefined);
  }, [open]);

  if (!open) {
    return null;
  }

  async function pasteAddress() {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) {
        setToWalletAddress(text.trim());
      }
    } catch {
      setError("Clipboard permission was blocked. Paste the address manually.");
    }
  }

  function submit() {
    const amount = Number(amountUSDC);

    if (!isAddress(fromWalletAddress)) {
      setError("Connect a wallet before sending.");
      return;
    }

    if (!isAddress(toWalletAddress)) {
      setError("Recipient wallet address is invalid.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than 0 USDC.");
      return;
    }

    const message = onSubmit({
      id: `direct_send_${Date.now().toString(36)}`,
      groupId: activeGroupId,
      groupName: activeGroupName,
      toName: "Recipient",
      toWalletAddress,
      fromWalletAddress,
      amountUSDC,
      amountVND: Math.round(amount * USDC_VND_RATE),
      note: note.trim() || "Direct Arc Testnet send"
    });

    if (message) {
      setError(message);
      return;
    }

    setToWalletAddress("");
    setAmountUSDC("");
    setNote("");
    onClose();
  }

  return (
    <BottomSheet open={open} title="Send USDC" subtitle="Arc Testnet transfer" onClose={onClose}>
      <div className="space-y-4">
        <Input
          label="Recipient wallet"
          value={toWalletAddress}
          placeholder="0x..."
          spellCheck={false}
          autoCapitalize="none"
          onChange={(event) => setToWalletAddress(event.target.value.trim())}
          rightSlot={
            <button type="button" className="focus-ring rounded-full p-2 text-[var(--text-muted)]" aria-label="Paste recipient address" onClick={() => void pasteAddress()}>
              <ClipboardPaste size={16} />
            </button>
          }
        />
        <Input label="Amount USDC" value={amountUSDC} placeholder="1.00" inputMode="decimal" onChange={(event) => setAmountUSDC(event.target.value)} />
        <TextArea label="Note" value={note} placeholder={activeGroupName ?? "Direct Arc Testnet send"} onChange={(event) => setNote(event.target.value)} />
        <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">
          This sends real Arc Testnet USDC from your connected wallet. Testnet only, no real funds.
        </div>
        {error ? <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--danger)]">{error}</div> : null}
        <Button fullWidth size="lg" icon={<ArrowUpRight size={18} />} onClick={submit}>
          Review send
        </Button>
      </div>
    </BottomSheet>
  );
}
