import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "muted";
type ButtonSize = "sm" | "md" | "lg" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  fullWidth?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--arc-accent)] text-white border border-[var(--arc-accent)] shadow-glow active:scale-[0.98]",
  secondary:
    "bg-transparent text-[var(--text-primary)] border border-[var(--border-strong)] active:scale-[0.98]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] border border-transparent active:scale-[0.98]",
  danger:
    "bg-[var(--danger)] text-white border border-[var(--danger)] active:scale-[0.98]",
  muted:
    "bg-[var(--row-bg)] text-[var(--text-primary)] border border-[var(--border-soft)] active:scale-[0.98]"
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-10 rounded-2xl px-3 text-sm",
  md: "h-12 rounded-[18px] px-4 text-sm",
  lg: "h-[52px] rounded-[18px] px-5 text-[15px]",
  icon: "h-11 w-11 rounded-2xl p-0"
};

export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "focus-ring inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        fullWidth ? "w-full" : "",
        className
      ].join(" ")}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
