import { useEffect, useState } from "react";
import { Link2, QrCode } from "lucide-react";
import { useGroupStore } from "../../state/useGroupStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";

type JoinGroupSheetProps = {
  open: boolean;
  initialCode?: string;
  onClose: () => void;
  onJoined?: (groupId?: string) => void;
  onOpenQR: () => void;
};

export function JoinGroupSheet({ open, initialCode, onClose, onJoined, onOpenQR }: JoinGroupSheetProps) {
  const { joinGroupByInviteCode } = useGroupStore();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string>();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setCode(initialCode ?? "");

    setMessage(undefined);
  }, [initialCode, open]);

  async function join() {
    setJoining(true);
    const result = await joinGroupByInviteCode(code);
    setJoining(false);

    if (result.ok) {
      setMessage(undefined);
      onJoined?.(result.groupId);
      onClose();
      return;
    }

    setMessage(result.message ?? "Could not join group.");
  }

  return (
    <BottomSheet
      open={open}
      title="Join group"
      subtitle="Use an invite code, link, or QR invite."
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" icon={<QrCode size={18} />} onClick={onOpenQR}>
            QR invite
          </Button>
          <Button icon={<Link2 size={18} />} onClick={join} disabled={joining}>
            {joining ? "Joining" : "Join"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Invite code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
        <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
          Codes sync through Firebase when cloud sync is configured.
        </div>
        {message ? (
          <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
            {message}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
