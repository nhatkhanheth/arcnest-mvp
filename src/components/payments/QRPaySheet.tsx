import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ClipboardPaste, Copy, QrCode, ScanLine, UserPlus } from "lucide-react";
import type { ArcNestInviteQRPayload, ArcNestPaymentQRPayload, ArcNestQRPayload, PaymentRequest } from "../../models";
import { createInviteQRPayload, createPaymentQRPayload, parseQRPayload, stringifyQRPayload } from "../../lib/qr";
import { USDC_VND_RATE } from "../../services/balanceService";
import { Button } from "../ui/Button";
import { TextArea } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";
import { QRGenerator } from "./QRGenerator";
import { QRScanner } from "./QRScanner";

type QRPaySheetProps = {
  open: boolean;
  mode?: "scan" | "myqr" | "payload" | "invite";
  primaryWalletAddress?: string;
  activeGroupId: string;
  activeGroupName?: string;
  inviteCode?: string;
  onClose: () => void;
  onPaymentPayload: (payload: ArcNestPaymentQRPayload) => string | undefined;
  onInvitePayload: (payload: ArcNestInviteQRPayload) => string | undefined;
  onEnsureInvite: (groupId: string) => string | undefined;
};

type QRTab = "scan" | "myqr" | "payload" | "invite";

const tabs: Array<{ id: QRTab; label: string; icon: ReactNode }> = [
  { id: "scan", label: "Scan", icon: <ScanLine size={16} /> },
  { id: "myqr", label: "My QR", icon: <QrCode size={16} /> },
  { id: "payload", label: "Paste", icon: <ClipboardPaste size={16} /> },
  { id: "invite", label: "Invite", icon: <UserPlus size={16} /> }
];

export function QRPaySheet({
  open,
  mode = "scan",
  primaryWalletAddress,
  activeGroupId,
  activeGroupName,
  inviteCode,
  onClose,
  onPaymentPayload,
  onInvitePayload,
  onEnsureInvite
}: QRPaySheetProps) {
  const [active, setActive] = useState<QRTab>(mode);
  const [payloadText, setPayloadText] = useState("");
  const [message, setMessage] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [ensuredInviteCode, setEnsuredInviteCode] = useState<string>();

  const paymentRequest = useMemo<PaymentRequest>(
    () => ({
      id: `qr_payment_${activeGroupId}`,
      groupId: activeGroupId,
      groupName: activeGroupName,
      toName: "You",
      toWalletAddress: primaryWalletAddress ?? "",
      fromWalletAddress: primaryWalletAddress ?? "",
      amountUSDC: "12.50",
      amountVND: Math.round(12.5 * USDC_VND_RATE),
      note: activeGroupName ? `${activeGroupName} payment` : "ArcNest QR Pay"
    }),
    [activeGroupId, activeGroupName, primaryWalletAddress]
  );
  const paymentPayload = useMemo<ArcNestPaymentQRPayload>(
    () =>
      createPaymentQRPayload({
        id: paymentRequest.id,
        receiverAddress: paymentRequest.toWalletAddress,
        amountUSDC: paymentRequest.amountUSDC,
        groupId: activeGroupId,
        note: paymentRequest.note
      }),
    [activeGroupId, paymentRequest]
  );
  const activeInviteCode = inviteCode ?? ensuredInviteCode;
  const invitePayload = useMemo<ArcNestInviteQRPayload | undefined>(
    () =>
      activeInviteCode
        ? createInviteQRPayload({
            groupId: activeGroupId,
            inviteCode: activeInviteCode
          })
        : undefined,
    [activeGroupId, activeInviteCode]
  );

  useEffect(() => {
    if (open) {
      setActive(mode);
      setPayloadText("");
      setMessage(undefined);
      setCopied(undefined);
    }
  }, [mode, open]);

  useEffect(() => {
    if (!open || active !== "invite" || inviteCode) {
      return;
    }

    setEnsuredInviteCode(onEnsureInvite(activeGroupId));
  }, [active, activeGroupId, inviteCode, onEnsureInvite, open]);

  function useRawPayload(rawPayload: string) {
    const result = parseQRPayload(rawPayload);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    const nextMessage =
      result.payload.type === "arcnest_payment"
        ? onPaymentPayload(result.payload)
        : onInvitePayload(result.payload);

    if (nextMessage) {
      setMessage(nextMessage);
      return;
    }

    setMessage(undefined);
    onClose();
  }

  function loadPayload(payload: ArcNestQRPayload) {
    setPayloadText(JSON.stringify(payload, null, 2));
    setMessage(undefined);
    setActive("payload");
  }

  function copyPayload(payload: ArcNestQRPayload, key: string) {
    void navigator.clipboard?.writeText(stringifyQRPayload(payload));
    setCopied(key);
  }

  return (
    <BottomSheet open={open} title="QR Pay" subtitle="Scan, request, or share an invite" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={[
                "focus-ring flex min-h-[44px] items-center justify-center gap-1 rounded-2xl border text-xs font-semibold",
                active === tab.id ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-soft)] text-[var(--text-muted)]"
              ].join(" ")}
              onClick={() => setActive(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {active === "scan" ? (
          <>
            <QRScanner onMockScan={() => useRawPayload(stringifyQRPayload(paymentPayload))} />
            <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
              Camera scanning is not wired in this demo. Paste a JSON QR payload, or use the scan preview above.
            </div>
            <Button fullWidth variant="secondary" icon={<ClipboardPaste size={18} />} onClick={() => setActive("payload")}>
              Paste QR payload
            </Button>
          </>
        ) : null}
        {active === "myqr" ? (
          <GeneratedPayload
            payload={paymentPayload}
            label="Payment QR"
            copied={copied === "payment"}
            onCopy={() => copyPayload(paymentPayload, "payment")}
            onLoad={() => loadPayload(paymentPayload)}
          />
        ) : null}
        {active === "invite" && invitePayload ? (
          <GeneratedPayload
            payload={invitePayload}
            label={`${activeGroupName ?? "Group"} invite QR`}
            copied={copied === "invite"}
            onCopy={() => copyPayload(invitePayload, "invite")}
            onLoad={() => loadPayload(invitePayload)}
          />
        ) : null}
        {active === "invite" && !invitePayload ? (
          <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--warning)]">Invite QR is not available for this group.</div>
        ) : null}
        {active === "payload" ? (
          <PayloadInput
            payloadText={payloadText}
            message={message}
            paymentPayload={paymentPayload}
            invitePayload={invitePayload}
            onChange={setPayloadText}
            onUse={() => useRawPayload(payloadText)}
            onLoadPayment={() => loadPayload(paymentPayload)}
            onLoadInvite={invitePayload ? () => loadPayload(invitePayload) : undefined}
          />
        ) : null}
      </div>
    </BottomSheet>
  );
}

function GeneratedPayload({
  payload,
  label,
  copied,
  onCopy,
  onLoad
}: {
  payload: ArcNestQRPayload;
  label: string;
  copied?: boolean;
  onCopy: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="space-y-4">
      <QRGenerator payload={payload} label={label} />
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" icon={<Copy size={18} />} onClick={onCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="muted" icon={<ClipboardPaste size={18} />} onClick={onLoad}>
          Paste view
        </Button>
      </div>
    </div>
  );
}

function PayloadInput({
  payloadText,
  message,
  paymentPayload,
  invitePayload,
  onChange,
  onUse,
  onLoadPayment,
  onLoadInvite
}: {
  payloadText: string;
  message?: string;
  paymentPayload: ArcNestQRPayload;
  invitePayload?: ArcNestQRPayload;
  onChange: (value: string) => void;
  onUse: () => void;
  onLoadPayment: () => void;
  onLoadInvite?: () => void;
}) {
  return (
    <div className="space-y-4">
      <TextArea
        label="Paste QR payload"
        value={payloadText}
        placeholder={stringifyQRPayload(paymentPayload)}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[180px] font-mono text-xs"
      />
      {message ? (
        <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
          {message}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onLoadPayment}>
          Payment demo
        </Button>
        <Button variant="secondary" onClick={onLoadInvite} disabled={!invitePayload}>
          Invite demo
        </Button>
      </div>
      <Button fullWidth icon={<ClipboardPaste size={18} />} onClick={onUse}>
        Use pasted QR
      </Button>
    </div>
  );
}
