import { Activity, CircleDollarSign, Home, UsersRound, WalletCards } from "lucide-react";
import type { NavTab } from "../../app/routes";
import { navTabs } from "../../app/routes";

type BottomNavProps = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
};

const icons = {
  home: Home,
  groups: UsersRound,
  split: CircleDollarSign,
  activity: Activity,
  wallet: WalletCards
};

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-40 w-[calc(100%-32px)] max-w-md -translate-x-1/2">
      <div className="glass-card grid grid-cols-5 rounded-[26px] p-2">
        {navTabs.map((tab) => {
          const Icon = icons[tab.id];
          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              className={[
                "focus-ring flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition",
                isActive ? "bg-[var(--arc-soft)] text-[var(--text-primary)]" : "text-[var(--text-muted)]"
              ].join(" ")}
              type="button"
              onClick={() => onChange(tab.id)}
            >
              <Icon size={20} strokeWidth={2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
