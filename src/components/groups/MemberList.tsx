import { Shield, UserRound } from "lucide-react";
import type { GroupMember } from "../../models";
import { shortAddress } from "../../lib/format";

type MemberListProps = {
  members: GroupMember[];
  compact?: boolean;
};

export function MemberList({ members, compact }: MemberListProps) {
  if (members.length === 0) {
    return (
      <div className="surface-row rounded-[18px] p-4">
        <p className="font-semibold">No members yet</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Add members or share an invite QR.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {members.slice(0, compact ? 4 : members.length).map((member) => (
        <div key={member.id} className="surface-row flex min-h-[62px] items-center justify-between gap-3 rounded-[18px] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--arc-soft)]">
              <UserRound size={18} />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{member.displayName}</span>
              <span className="number block truncate text-xs text-[var(--text-muted)]">{shortAddress(member.walletAddress)}</span>
            </span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-soft)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--text-secondary)]">
            <Shield size={13} />
            {member.role}
          </span>
        </div>
      ))}
    </div>
  );
}
