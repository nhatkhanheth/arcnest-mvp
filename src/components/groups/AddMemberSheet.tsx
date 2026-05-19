import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import type { MemberRole } from "../../models";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";

type AddMemberSheetProps = {
  open: boolean;
  roleOptions: MemberRole[];
  onClose: () => void;
  onSave: (input: { displayName: string; walletAddress?: string; role: MemberRole }) => { ok: boolean; message?: string };
};

export function AddMemberSheet({ open, roleOptions, onClose, onSave }: AddMemberSheetProps) {
  const [displayName, setDisplayName] = useState("New member");
  const [walletAddress, setWalletAddress] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) {
      return;
    }

    setDisplayName("New member");
    setWalletAddress("");
    setRole(roleOptions.includes("member") ? "member" : roleOptions[0] ?? "member");
    setError(undefined);
  }, [open, roleOptions]);

  function save() {
    if (!displayName.trim()) {
      setError("Add a member name.");
      return;
    }

    const result = onSave({
      displayName,
      walletAddress: walletAddress.trim() || undefined,
      role
    });

    if (result.ok) {
      onClose();
      return;
    }

    setError(result.message ?? "Could not add member.");
  }

  return (
    <BottomSheet
      open={open}
      title="Add member"
      subtitle="Local member only. No invite is sent yet."
      onClose={onClose}
      footer={
        <Button fullWidth icon={<UserPlus size={18} />} onClick={save} disabled={roleOptions.length === 0}>
          Add member
        </Button>
      }
    >
      <div className="space-y-4">
        <Input label="Name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <Input label="Wallet address" placeholder="Optional" value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} />
        <Select label="Role" value={role} onChange={(event) => setRole(event.target.value as MemberRole)}>
          {roleOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
        {error ? (
          <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
            {error}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
