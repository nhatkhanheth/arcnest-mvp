import { useState } from "react";

const logoSources = ["/logo.png", "/logo.jpg", "/logo.jpeg"];

type AppLogoProps = {
  size?: number;
  variant?: "default" | "login" | "header";
  className?: string;
  rounded?: string;
  imageClassName?: string;
};

export function AppLogo({ size, variant = "default", className = "", rounded, imageClassName = "" }: AppLogoProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = logoSources[sourceIndex];
  const visualSize = size ?? (variant === "login" ? 120 : variant === "header" ? 48 : 56);
  const shellRadius = rounded ?? (variant === "login" ? "rounded-[30px]" : variant === "header" ? "rounded-[16px]" : "rounded-[20px]");

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center",
        "overflow-hidden border border-[var(--border-soft)] bg-[var(--bg-main)] shadow-[0_14px_42px_var(--shadow-soft)]",
        shellRadius,
        className
      ].join(" ")}
      style={{ width: visualSize, height: visualSize }}
      aria-hidden="true"
    >
      {source ? (
        <img
          src={source}
          alt=""
          className={[
            "block h-full w-full object-contain",
            variant === "login" ? "scale-[0.9]" : "",
            variant === "header" ? "scale-[0.86]" : "scale-[0.88]",
            imageClassName
          ].join(" ")}
          style={{ imageRendering: "auto" }}
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        <span className="font-display text-xl font-bold">A</span>
      )}
    </span>
  );
}
