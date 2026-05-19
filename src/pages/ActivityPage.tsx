import { ActivityItem } from "../components/activity/ActivityItem";
import { Card } from "../components/ui/Card";
import { useGroupStore } from "../state/useGroupStore";

export function ActivityPage() {
  const { activities, expenses, groups, members, payments } = useGroupStore();

  return (
    <main className="screen-pad space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--text-muted)]">Activity</p>
        <h1 className="font-display text-[28px] font-bold">Recent updates</h1>
      </header>

      <Card>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Expenses" value={String(expenses.filter((expense) => expense.status === "active" || expense.status === "edited").length)} />
          <Stat label="Payments" value={String(payments.length)} />
          <Stat label="Members" value={String(members.filter((member) => member.status === "active").length)} />
        </div>
      </Card>

      <section className="space-y-3">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} group={groups.find((group) => group.id === activity.groupId)} />
          ))
        ) : (
          <div className="surface-row rounded-[20px] p-4">
            <p className="font-semibold">No activity yet</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Group, expense, payment, and invite updates will show up here.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-row rounded-2xl p-3">
      <p className="number text-xl font-bold">{value}</p>
      <p className="text-xs font-semibold text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
