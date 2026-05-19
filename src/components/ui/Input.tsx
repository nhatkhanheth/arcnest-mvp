import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  rightSlot?: ReactNode;
};

export function Input({ label, rightSlot, className = "", ...props }: InputProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      ) : null}
      <span className="surface-row flex h-[54px] items-center rounded-[18px] px-4 transition focus-within:shadow-[0_0_0_3px_var(--arc-glow)]">
        <input
          className={[
            "w-full bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]",
            className
          ].join(" ")}
          {...props}
        />
        {rightSlot}
      </span>
    </label>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  children: ReactNode;
};

export function Select({ label, children, className = "", ...props }: SelectProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      ) : null}
      <select
        className={[
          "surface-row focus-ring h-[54px] w-full rounded-[18px] px-4 text-[15px] text-[var(--text-primary)] outline-none",
          className
        ].join(" ")}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export function TextArea({ label, className = "", ...props }: TextAreaProps) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-xs font-semibold text-[var(--text-muted)]">{label}</span>
      ) : null}
      <textarea
        className={[
          "surface-row focus-ring min-h-24 w-full resize-none rounded-[18px] px-4 py-3 text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]",
          className
        ].join(" ")}
        {...props}
      />
    </label>
  );
}
