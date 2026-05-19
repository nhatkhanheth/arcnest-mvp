import type { SplitMode } from "../../models";

type SplitModeSelectorProps = {
  value: SplitMode;
  onChange: (value: SplitMode) => void;
};

const modes: Array<{ id: SplitMode; label: string; detail: string }> = [
  { id: "equal", label: "Equal", detail: "Evenly shared" },
  { id: "fixed", label: "Fixed", detail: "Same amount" },
  { id: "custom", label: "Custom", detail: "Manual shares" },
  { id: "treasury", label: "Treasury", detail: "Paid by group" }
];

export function SplitModeSelector({ value, onChange }: SplitModeSelectorProps) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Split mode</p>
      <div className="grid grid-cols-2 gap-2">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={[
              "focus-ring min-h-[62px] rounded-[18px] border p-3 text-left transition",
              value === mode.id ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-soft)] bg-[var(--row-bg)]"
            ].join(" ")}
            onClick={() => onChange(mode.id)}
          >
            <span className="block font-semibold">{mode.label}</span>
            <span className="text-xs text-[var(--text-muted)]">{mode.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
