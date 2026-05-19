import { Plus, ScanLine } from "lucide-react";
import { Button } from "../components/ui/Button";
import { GroupCard } from "../components/groups/GroupCard";
import { useGroupStore } from "../state/useGroupStore";

type GroupsPageProps = {
  onOpenGroup: (groupId: string) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
};

export function GroupsPage({ onOpenGroup, onCreateGroup, onJoinGroup }: GroupsPageProps) {
  const { globalSummary, groups, members } = useGroupStore();

  return (
    <main className="screen-pad space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--text-muted)]">Groups</p>
        <h1 className="font-display text-[28px] font-bold">Shared spaces</h1>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <Button icon={<Plus size={18} />} onClick={onCreateGroup}>
          Create
        </Button>
        <Button variant="secondary" icon={<ScanLine size={18} />} onClick={onJoinGroup}>
          Join
        </Button>
      </div>

      <section className="space-y-4">
        {groups.length > 0 ? (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              members={members.filter((member) => member.groupId === group.id)}
              summary={globalSummary.groups.find((summary) => summary.groupId === group.id)}
              onOpen={() => onOpenGroup(group.id)}
            />
          ))
        ) : (
          <div className="surface-row rounded-[20px] p-4">
            <p className="font-semibold">No groups yet</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Create a group or join one with an invite QR to start splitting expenses.</p>
          </div>
        )}
      </section>
    </main>
  );
}
