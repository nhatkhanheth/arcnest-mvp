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
        source
          ? "overflow-visible border border-transparent bg-transparent shadow-none"
          : "overflow-hidden border border-[var(--border-soft)] bg-[var(--arc-soft)] shadow-[0_14px_42px_rgba(49,57,251,0.18)]",
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
            variant === "login" ? "scale-[1.04]" : "",
            variant === "header" ? "scale-[1.08]" : "",
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
