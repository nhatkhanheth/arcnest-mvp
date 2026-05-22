import { ScanLine } from "lucide-react";

export function QRScanner() {
  return (
    <div className="block w-full text-left">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-[var(--bg-card)]">
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-40">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className="border border-[var(--border-soft)]" />
          ))}
        </div>
        <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-[var(--arc-accent)] shadow-glow" />
        <div className="absolute inset-x-8 top-16 flex justify-between">
          <Corner />
          <Corner flipped />
        </div>
        <div className="absolute inset-x-8 bottom-16 flex justify-between">
          <Corner bottom />
          <Corner bottom flipped />
        </div>
        <div className="absolute inset-x-0 bottom-7 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--text-secondary)]">
          <ScanLine size={18} />
          Camera scan coming soon
        </div>
      </div>
    </div>
  );
}

function Corner({ flipped, bottom }: { flipped?: boolean; bottom?: boolean }) {
  return (
    <span
      className={[
        "block h-10 w-10 border-[3px] border-[var(--text-primary)]",
        flipped ? "rotate-90" : "",
        bottom ? "-rotate-90" : "",
        flipped && bottom ? "rotate-180" : "",
        "border-b-0 border-r-0"
      ].join(" ")}
    />
  );
}
