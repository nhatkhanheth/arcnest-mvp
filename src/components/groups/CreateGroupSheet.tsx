import { useState } from "react";
import { Plus } from "lucide-react";
import type { GroupType } from "../../models";
import { useGroupStore } from "../../state/useGroupStore";
import { useSettingsStore } from "../../state/useSettingsStore";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";

type CreateGroupSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function CreateGroupSheet({ open, onClose }: CreateGroupSheetProps) {
  const { createGroup } = useGroupStore();
  const { defaultGroupCurrency } = useSettingsStore();
  const [name, setName] = useState("Weekend Food Club");
  const [type, setType] = useState<GroupType>("friends");
  const [treasury, setTreasury] = useState(true);
  const [error, setError] = useState<string>();

  function save() {
    if (!name.trim()) {
      setError("Add a group name.");
      return;
    }

    const result = createGroup({ name, type, treasuryEnabled: treasury, defaultCurrency: defaultGroupCurrency });

    if (result.ok) {
      setError(undefined);
      onClose();
      return;
    }

    setError(result.message ?? "Could not create group.");
  }

  return (
    <BottomSheet
      open={open}
      title="Create group"
      subtitle="Saved locally first, then synced to Firebase."
      onClose={onClose}
      footer={
        <Button fullWidth icon={<Plus size={18} />} onClick={save}>
          Create group
        </Button>
      }
    >
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
            <span className="text-sm text-[var(--text-muted)]">Optional shared balance</span>
          </span>
          <span className={["h-7 w-12 rounded-full border p-1 transition", treasury ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-strong)]"].join(" ")}>
            <span className={["block h-5 w-5 rounded-full bg-[var(--text-primary)] transition", treasury ? "translate-x-5" : ""].join(" ")} />
          </span>
        </button>
        {error ? (
          <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
            {error}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
