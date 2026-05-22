import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import QRCode from "qrcode";
import { ClipboardPaste, Copy, Download, ImageDown, Link2, QrCode, ScanLine, Share2, UserPlus } from "lucide-react";
import type { ArcNestInviteQRPayload, ArcNestPaymentQRPayload, ArcNestQRPayload, PaymentRequest } from "../../models";
import { createInviteQRPayload, createPaymentQRPayload, createQRPayloadUri, parseQRPayload, stringifyQRPayload } from "../../lib/qr";
import { USDC_VND_RATE } from "../../services/balanceService";
import { getInviteUrl } from "../../services/inviteService";
import { Button } from "../ui/Button";
import { Input, TextArea } from "../ui/Input";
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
  const [qrAmountUSDC, setQRAmountUSDC] = useState("12.50");
  const [qrNote, setQRNote] = useState("");

  const paymentRequest = useMemo<PaymentRequest>(
    () => ({
      id: `qr_payment_${activeGroupId}`,
      groupId: activeGroupId,
      groupName: activeGroupName,
      toName: "You",
      toWalletAddress: primaryWalletAddress ?? "",
      fromWalletAddress: primaryWalletAddress ?? "",
      amountUSDC: qrAmountUSDC,
      amountVND: Math.round(Number(qrAmountUSDC || 0) * USDC_VND_RATE),
      note: qrNote.trim() || (activeGroupName ? `${activeGroupName} payment` : "ArcNest QR Pay")
    }),
    [activeGroupId, activeGroupName, primaryWalletAddress, qrAmountUSDC, qrNote]
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
  const inviteLink = activeInviteCode ? getInviteUrl(activeInviteCode) : undefined;
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
  const paymentQRValue = useMemo(() => createQRPayloadUri(paymentPayload), [paymentPayload]);
  const inviteQRValue = invitePayload ? inviteLink ?? createQRPayloadUri(invitePayload) : undefined;

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

  async function copyText(value: string, key: string, success = "Copied.") {
    try {
      await navigator.clipboard?.writeText(value);
      setCopied(key);
      setMessage(success);
    } catch {
      setMessage("Copy is not available in this browser.");
    }
  }

  async function downloadQR(value: string, fileName: string) {
    try {
      const dataUrl = await createQRDataUrl(value);
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = fileName;
      anchor.click();
      setMessage("QR image downloaded.");
    } catch {
      setMessage("QR image could not be downloaded.");
    }
  }

  async function copyQRImage(value: string) {
    try {
      if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
        setMessage("QR image copy is not supported in this browser.");
        return;
      }

      const dataUrl = await createQRDataUrl(value);
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopied("image");
      setMessage("QR image copied.");
    } catch {
      setMessage("QR image copy failed. Use download instead.");
    }
  }

  async function shareQR({ title, text, url }: { title: string; text: string; url?: string }) {
    try {
      if (!navigator.share) {
        await copyText(url ?? text, "share", "Share text copied.");
        return;
      }

      await navigator.share({ title, text, url });
      setMessage("Share sheet opened.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setMessage("Share failed. Copy the payload or link instead.");
    }
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
        {message && active !== "payload" ? (
          <div className="surface-row rounded-[18px] p-3 text-sm text-[var(--text-secondary)]">{message}</div>
        ) : null}
        {active === "scan" ? (
          <>
            <QRScanner />
            <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
              Camera scan coming soon. Paste an ArcNest QR payload or invite link to load the payment or group invite.
            </div>
            <Button fullWidth variant="secondary" icon={<ClipboardPaste size={18} />} onClick={() => setActive("payload")}>
              Paste QR payload
            </Button>
          </>
        ) : null}
        {active === "myqr" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Amount USDC" inputMode="decimal" value={qrAmountUSDC} onChange={(event) => setQRAmountUSDC(event.target.value)} />
              <Input label="Note" value={qrNote} placeholder={activeGroupName ?? "ArcNest"} onChange={(event) => setQRNote(event.target.value)} />
            </div>
            <GeneratedPayload
              payload={paymentPayload}
              qrValue={paymentQRValue}
              label="Payment QR"
              copied={copied === "payment"}
              onCopy={() => void copyText(stringifyQRPayload(paymentPayload), "payment", "Payment payload copied.")}
              onCopyImage={() => void copyQRImage(paymentQRValue)}
              onDownload={() => void downloadQR(paymentQRValue, `arcnest-payment-${paymentPayload.paymentId}.png`)}
              onShare={() =>
                void shareQR({
                  title: "ArcNest payment",
                  text: stringifyQRPayload(paymentPayload)
                })
              }
              onLoad={() => loadPayload(paymentPayload)}
            />
          </div>
        ) : null}
        {active === "invite" && invitePayload && inviteQRValue ? (
          <GeneratedPayload
            payload={invitePayload}
            qrValue={inviteQRValue}
            label={`${activeGroupName ?? "Group"} invite QR`}
            copied={copied === "invite"}
            inviteLink={inviteLink}
            onCopy={() => void copyText(stringifyQRPayload(invitePayload), "invite", "Invite payload copied.")}
            onCopyLink={inviteLink ? () => void copyText(inviteLink, "invite-link", "Invite link copied.") : undefined}
            onCopyImage={() => void copyQRImage(inviteQRValue)}
            onDownload={() => void downloadQR(inviteQRValue, `arcnest-invite-${activeInviteCode ?? "group"}.png`)}
            onShare={() =>
              void shareQR({
                title: "Join my ArcNest group",
                text: `Join ${activeGroupName ?? "my group"} on ArcNest`,
                url: inviteLink
              })
            }
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
  qrValue,
  label,
  copied,
  inviteLink,
  onCopy,
  onCopyLink,
  onCopyImage,
  onDownload,
  onShare,
  onLoad
}: {
  payload: ArcNestQRPayload;
  qrValue: string;
  label: string;
  copied?: boolean;
  inviteLink?: string;
  onCopy: () => void;
  onCopyLink?: () => void;
  onCopyImage: () => void;
  onDownload: () => void;
  onShare: () => void;
  onLoad: () => void;
}) {
  return (
    <div className="space-y-4">
      <QRGenerator value={qrValue} label={label} />
      {inviteLink ? (
        <div className="surface-row rounded-[18px] p-3">
          <p className="text-xs font-semibold text-[var(--text-muted)]">Invite link</p>
          <p className="number mt-1 truncate text-sm">{inviteLink}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" icon={<Copy size={18} />} onClick={onCopy}>
          {copied ? "Copied" : "Copy payload"}
        </Button>
        {onCopyLink ? (
          <Button variant="secondary" icon={<Link2 size={18} />} onClick={onCopyLink}>
            Copy link
          </Button>
        ) : null}
        <Button variant="muted" icon={<ImageDown size={18} />} onClick={onCopyImage}>
          Copy image
        </Button>
        <Button variant="muted" icon={<Download size={18} />} onClick={onDownload}>
          Download
        </Button>
        <Button variant="muted" icon={<Share2 size={18} />} onClick={onShare}>
          Share
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
          Load payment
        </Button>
        <Button variant="secondary" onClick={onLoadInvite} disabled={!invitePayload}>
          Load invite
        </Button>
      </div>
      <Button fullWidth icon={<ClipboardPaste size={18} />} onClick={onUse}>
        Use pasted QR
      </Button>
    </div>
  );
}

function createQRDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: {
      dark: "#080810",
      light: "#f7f4ea"
    }
  });
}
