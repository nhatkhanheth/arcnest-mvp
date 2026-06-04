type CopyToastProps = {
  message?: string;
};

export function CopyToast({ message }: CopyToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[80] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)]/95 px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-soft backdrop-blur"
      >
        {message}
      </div>
    </div>
  );
}
