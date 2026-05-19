import type { ArcNestQRPayload } from "../../models";
import { stringifyQRPayload } from "../../lib/qr";

type QRGeneratorProps = {
  payload: ArcNestQRPayload;
  label: string;
};

function makeCells(seed: string) {
  return Array.from({ length: 256 }, (_, index) => {
    const code = seed.charCodeAt(index % seed.length);
    const inMarker =
      (index < 48 && index % 16 < 3) ||
      (index < 48 && index % 16 > 12) ||
      (index > 207 && index % 16 < 3);
    return inMarker || (code + index * 7) % 5 < 2;
  });
}

export function QRGenerator({ payload, label }: QRGeneratorProps) {
  const content = stringifyQRPayload(payload);
  const cells = makeCells(content);

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[260px] rounded-[28px] bg-[var(--text-primary)] p-5">
        <div className="grid aspect-square grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
          {cells.map((filled, index) => (
            <span key={index} className={filled ? "rounded-sm bg-[var(--bg-main)]" : "rounded-sm bg-transparent"} />
          ))}
        </div>
      </div>
      <div className="text-center">
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Payload-ready QR preview</p>
      </div>
    </div>
  );
}
