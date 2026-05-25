import { useState } from "react";

const logoSources = ["/logo.png", "/logo.jpg", "/logo.jpeg"];

type AppLogoProps = {
  size?: number;
  className?: string;
  rounded?: string;
  imageClassName?: string;
};

export function AppLogo({ size = 56, className = "", rounded = "rounded-[20px]", imageClassName = "" }: AppLogoProps) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = logoSources[sourceIndex];

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-[var(--border-soft)] bg-[var(--arc-soft)] shadow-[0_14px_42px_rgba(49,57,251,0.18)]",
        rounded,
        className
      ].join(" ")}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {source ? (
        <img
          src={source}
          alt=""
          className={["h-full w-full object-contain", imageClassName].join(" ")}
          style={{ imageRendering: "auto" }}
          onError={() => setSourceIndex((current) => current + 1)}
        />
      ) : (
        <span className="font-display text-xl font-bold">A</span>
      )}
    </span>
  );
}
