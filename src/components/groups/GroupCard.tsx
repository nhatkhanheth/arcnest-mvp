import { ChevronRight, ShieldCheck, UsersRound } from "lucide-react";
import type { Group, GroupBalanceSummary, GroupMember } from "../../models";
import { formatUSDC } from "../../lib/format";
import { Card } from "../ui/Card";

type GroupCardProps = {
  group: Group;
  members: GroupMember[];
  summary?: GroupBalanceSummary;
  onOpen: () => void;
};

const typeLabels: Record<Group["type"], string> = {
  family: "Family",
  friends: "Friends",
  sports: "Sports",
  travel: "Travel",
  work: "Work",
  roommates: "Roommates",
  community: "Community",
  other: "Other"
};

export function GroupCard({ group, members, summary, onOpen }: GroupCardProps) {
  const net = Number(summary?.netUSDC ?? 0);

  return (
    <button type="button" className="focus-ring block w-full text-left" onClick={onOpen}>
      <Card className="transition active:scale-[0.99]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
              <UsersRound size={14} />
              {typeLabels[group.type]} group
            </div>
            <h3 className="mt-2 font-display text-lg font-bold">{group.name}</h3>
          </div>
          <ChevronRight className="mt-1 text-[var(--text-muted)]" size={20} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="surface-row rounded-2xl p-3">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Your net</p>
            <p className={["number mt-1 text-lg font-bold", net >= 0 ? "text-[var(--success)]" : "text-[var(--warning)]"].join(" ")}>
              {formatUSDC(summary?.netUSDC ?? "0.00", { signed: true })}
            </p>
          </div>
          <div className="surface-row rounded-2xl p-3">
            <p className="text-xs font-semibold text-[var(--text-muted)]">Paid</p>
            <p className="number mt-1 text-lg font-bold">{summary?.paidPercent ?? 0}%</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>{members.length} members</span>
          {group.treasuryEnabled ? (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={15} /> Treasury
            </span>
          ) : (
            <span>Direct pay</span>
          )}
        </div>
      </Card>
    </button>
  );
}
