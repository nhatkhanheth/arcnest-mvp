import { Archive, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Group, GroupType } from "../../models";
import type { GroupDraft } from "../../services/groupService";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";

type GroupManageSheetProps = {
  open: boolean;
  group: Group;
  onClose: () => void;
  onSave: (draft: GroupDraft) => { ok: boolean; message?: string };
  onArchive: () => { ok: boolean; message?: string };
  onDelete: () => { ok: boolean; message?: string };
};

export function GroupManageSheet({ open, group, onClose, onSave, onArchive, onDelete }: GroupManageSheetProps) {
  const [name, setName] = useState(group.name);
  const [type, setType] = useState<GroupType>(group.type);
  const [treasury, setTreasury] = useState(group.treasuryEnabled);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(group.name);
    setType(group.type);
    setTreasury(group.treasuryEnabled);
    setMessage(undefined);
  }, [group.id, group.name, group.treasuryEnabled, group.type, open]);

  function save() {
    const result = onSave({
      name,
      type,
      treasuryEnabled: treasury,
      defaultCurrency: group.defaultCurrency
    });

    if (result.ok) {
      setMessage("Group updated.");
      return;
    }

    setMessage(result.message ?? "Could not update group.");
  }

  function archive() {
    if (!window.confirm("Archive this group? Members will no longer see it as active.")) {
      return;
    }

    const result = onArchive();
    setMessage(result.message ?? (result.ok ? "Group archived." : "Could not archive group."));
    if (result.ok) {
      onClose();
    }
  }

  function remove() {
    if (!window.confirm("Delete this group? Records are kept for audit history, but the group will be hidden.")) {
      return;
    }

    const result = onDelete();
    setMessage(result.message ?? (result.ok ? "Group deleted." : "Could not delete group."));
    if (result.ok) {
      onClose();
    }
  }

  return (
    <BottomSheet open={open} title="Manage group" subtitle="Owner and admin controls" onClose={onClose}>
      <div className="space-y-4">
        <Input label="Group name" value={name} onChange={(event) => setName(event.target.value)} />
        <Select label="Group type" value={type} onChange={(event) => setType(event.target.value as GroupType)}>
          <option value="family">Family</option>
          <option value="friends">Friends</option>
          <option value="sports">Sports</option>
          <option value="travel">Travel</option>
          <option value="work">Work</option>
          <option value="roommates">Roommates</option>
          <option value="community">Community</option>
          <option value="other">Other</option>
        </Select>
        <button
          type="button"
          className="surface-row focus-ring flex min-h-[58px] w-full items-center justify-between rounded-[18px] px-4 text-left"
          onClick={() => setTreasury((value) => !value)}
        >
          <span>
            <span className="block font-semibold">Group treasury</span>
            <span className="text-sm text-[var(--text-muted)]">Used only when treasury split is selected</span>
          </span>
          <span className={["h-7 w-12 rounded-full border p-1 transition", treasury ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-strong)]"].join(" ")}>
            <span className={["block h-5 w-5 rounded-full bg-[var(--text-primary)] transition", treasury ? "translate-x-5" : ""].join(" ")} />
          </span>
        </button>
        <Button fullWidth icon={<Pencil size={17} />} onClick={save}>
          Save group
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="muted" icon={<Archive size={16} />} onClick={archive}>
            Archive
          </Button>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={remove}>
            Delete
          </Button>
        </div>
        {message ? (
          <div className="rounded-[18px] border border-[var(--arc-accent)]/40 bg-[var(--arc-soft)] p-4 text-sm text-[var(--text-secondary)]">
            {message}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
