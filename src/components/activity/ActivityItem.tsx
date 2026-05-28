import { CreditCard, FilePenLine, FilePlus2, Shield, TriangleAlert, UserPlus, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import type { Activity, Group } from "../../models";
import { formatTime } from "../../lib/format";

type ActivityItemProps = {
  activity: Activity;
  group?: Group;
};

const icons: Partial<Record<Activity["type"], ReactNode>> = {
  group_created: <UsersRound size={18} />,
  expense_created: <FilePlus2 size={18} />,
  expense_edited: <FilePenLine size={18} />,
  payment_started: <CreditCard size={18} />,
  payment_paid: <CreditCard size={18} />,
  payment_failed: <TriangleAlert size={18} />,
  member_joined: <UserPlus size={18} />,
  role_changed: <Shield size={18} />,
  invite_created: <UserPlus size={18} />,
  invite_used: <UserPlus size={18} />
};

export function ActivityItem({ activity, group }: ActivityItemProps) {
  return (
    <div className="surface-row flex gap-3 rounded-[18px] p-4">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--arc-soft)]">
        {icons[activity.type] ?? <FilePlus2 size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{copyFor(activity)}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{group?.name ?? "ArcNest"}</p>
        <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">{formatTime(activity.createdAt)}</p>
      </div>
    </div>
  );
}

function copyFor(activity: Activity) {
  const metadata = activity.metadata ?? {};

  switch (activity.type) {
    case "group_created":
      return `Group created: ${String(metadata.groupName ?? "New group")}`;
    case "expense_created":
      return `Expense created: ${String(metadata.title ?? "Shared expense")}`;
    case "expense_edited":
      return `Expense updated: ${String(metadata.title ?? "Shared expense")}`;
    case "payment_started":
      return `Payment started: ${String(metadata.amountUSDC ?? "0.00")} USDC`;
    case "payment_paid":
      return `Payment successful: ${String(metadata.amountUSDC ?? "0.00")} USDC`;
    case "payment_failed":
      return `Payment failed: ${String(metadata.amountUSDC ?? "0.00")} USDC`;
    case "member_joined":
      return `${String(metadata.memberName ?? "A member")} joined`;
    case "invite_created":
      return `Invite created: ${String(metadata.inviteCode ?? "QR invite")}`;
    case "invite_used":
      return `Invite used: ${String(metadata.inviteCode ?? "QR invite")}`;
    case "role_changed":
      return `${String(metadata.memberName ?? "A member")} is now ${String(metadata.newRole ?? metadata.role ?? "Member")}`;
    default:
      return "Activity updated";
  }
}
