import { useMemo, useState } from "react";
import type { GroupMember, MemberPermissions, MemberRole } from "../../models";
import { Select } from "../ui/Input";

type PermissionEditorProps = {
  members: GroupMember[];
  presets: Record<MemberRole, MemberPermissions>;
  actorMemberId?: string;
  canManage: boolean;
  assignableRoles: MemberRole[];
  onChangeRole: (memberId: string, role: MemberRole) => { ok: boolean; message?: string };
};

const permissionLabels: Array<{ key: keyof MemberPermissions; label: string }> = [
  { key: "canAddExpenses", label: "Add expenses" },
  { key: "canEditOwnExpenses", label: "Edit own expenses" },
  { key: "canEditAllExpenses", label: "Edit all expenses" },
  { key: "canDeleteExpenses", label: "Delete expenses" },
  { key: "canViewAllBalances", label: "View all balances" },
  { key: "canInviteMembers", label: "Invite members" },
  { key: "canManageMembers", label: "Manage members" },
  { key: "canManageTreasury", label: "Manage treasury" },
  { key: "canWithdrawTreasury", label: "Withdraw treasury" }
];

export function PermissionEditor({ members, presets, actorMemberId, canManage, assignableRoles, onChangeRole }: PermissionEditorProps) {
  const [role, setRole] = useState<MemberRole>("owner");
  const [message, setMessage] = useState<string>();
  const roleMembers = useMemo(() => members.filter((member) => member.role === role), [members, role]);
  const permissions = presets[role];

  function changeRole(memberId: string, nextRole: MemberRole) {
    const result = onChangeRole(memberId, nextRole);
    setMessage(result.ok ? undefined : result.message ?? "Role was not updated.");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {(["owner", "admin", "editor", "member"] as MemberRole[]).map((item) => (
          <button
            key={item}
            type="button"
            className={[
              "focus-ring h-10 rounded-2xl border px-2 text-xs font-semibold capitalize",
              role === item
                ? "border-[var(--arc-accent)] bg-[var(--arc-soft)] text-[var(--text-primary)]"
                : "border-[var(--border-soft)] text-[var(--text-muted)]"
            ].join(" ")}
            onClick={() => setRole(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
        {roleMembers.length > 0 ? roleMembers.map((member) => member.displayName).join(", ") : "No member uses this role yet"}
      </div>
      <div className="space-y-2">
        {members.map((member) => {
          const options = assignableRoles.includes(member.role) ? assignableRoles : [member.role];
          return (
            <div key={member.id} className="surface-row rounded-[18px] p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{member.displayName}</p>
                  <p className="text-xs capitalize text-[var(--text-muted)]">{member.role}</p>
                </div>
                <div className="w-32">
                  <Select
                    aria-label={`Role for ${member.displayName}`}
                    value={member.role}
                    disabled={!canManage || member.id === actorMemberId}
                    onChange={(event) => changeRole(member.id, event.target.value as MemberRole)}
                  >
                    {options.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {message ? (
        <div className="rounded-[18px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-4 text-sm text-[var(--warning)]">
          {message}
        </div>
      ) : null}
      <div className="space-y-2">
        {permissionLabels.map((permission) => (
          <div key={permission.key} className="surface-row flex min-h-[50px] w-full items-center justify-between rounded-2xl px-4 text-left">
            <span className="text-sm font-medium">{permission.label}</span>
            <span
              className={[
                "relative h-6 w-11 rounded-full border transition",
                permissions[permission.key] ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-strong)]"
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-1 h-4 w-4 rounded-full bg-[var(--text-primary)] transition",
                  permissions[permission.key] ? "left-6" : "left-1"
                ].join(" ")}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
