import { CheckCircle2, CircleDashed, TriangleAlert } from "lucide-react";

type NetworkBadgeProps = {
  status?: "active" | "mock" | "wrong";
  label?: string;
};

export function NetworkBadge({ status = "active", label }: NetworkBadgeProps) {
  const resolvedLabel = label ?? (status === "wrong" ? "Wrong network" : status === "mock" ? "Arc mock" : "Arc active");
  const icon = status === "wrong" ? <TriangleAlert size={14} /> : status === "mock" ? <CircleDashed size={14} /> : <CheckCircle2 size={14} />;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
        status === "wrong" ? "border-[var(--danger)]/50 bg-[var(--danger)]/10 text-[var(--danger)]" : "",
        status === "mock" ? "border-[var(--warning)]/50 bg-[var(--warning)]/10 text-[var(--warning)]" : "",
        status === "active" ? "border-[var(--border-soft)] bg-[var(--arc-soft)] text-[var(--text-primary)]" : ""
      ].join(" ")}
    >
      {icon}
      {resolvedLabel}
    </span>
  );
}
