import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

type QRGeneratorProps = {
  value: string;
  label: string;
};

export function QRGenerator({ value, label }: QRGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    void QRCode.toCanvas(canvasRef.current, value, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#080810",
        light: "#f7f4ea"
      }
    })
      .then(() => setError(undefined))
      .catch(() => setError("QR image could not be generated."));
  }, [value]);

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[260px] rounded-[28px] bg-[var(--text-primary)] p-4">
        <canvas ref={canvasRef} className="block aspect-square h-auto w-full rounded-[18px]" aria-label={label} />
      </div>
      <div className="text-center">
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Scannable QR payload</p>
        {error ? <p className="mt-1 text-sm text-[var(--danger)]">{error}</p> : null}
      </div>
    </div>
  );
}
