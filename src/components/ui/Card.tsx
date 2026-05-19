import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padded?: boolean;
};

export function Card({ children, className = "", padded = true, ...props }: CardProps) {
  return (
    <div className={["glass-card rounded-3xl", padded ? "p-4" : "", className].join(" ")} {...props}>
      {children}
    </div>
  );
}
