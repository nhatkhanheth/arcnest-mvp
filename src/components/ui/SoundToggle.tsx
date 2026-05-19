import { Bell, BellOff } from "lucide-react";

type SoundToggleProps = {
  label: string;
  enabled: boolean;
  onChange?: (enabled: boolean) => void;
};

export function SoundToggle({ label, enabled, onChange }: SoundToggleProps) {
  return (
    <button
      type="button"
      className="surface-row focus-ring flex min-h-[54px] w-full items-center justify-between gap-3 rounded-[18px] px-4 text-left transition active:scale-[0.99]"
      onClick={() => onChange?.(!enabled)}
    >
      <span className="flex items-center gap-3">
        {enabled ? <Bell size={18} /> : <BellOff size={18} />}
        <span className="font-medium">{label}</span>
      </span>
      <span
        className={[
          "relative h-7 w-12 rounded-full border transition",
          enabled ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-strong)] bg-transparent"
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 h-5 w-5 rounded-full bg-[var(--text-primary)] transition",
            enabled ? "left-6" : "left-1"
          ].join(" ")}
        />
      </span>
    </button>
  );
}
