import { Moon, Sun } from "lucide-react";
import type { ThemeMode } from "../../models";
import { Button } from "./Button";

type ThemeToggleProps = {
  theme: ThemeMode;
  onToggle: () => void;
  compact?: boolean;
};

export function ThemeToggle({ theme, onToggle, compact }: ThemeToggleProps) {
  const isLight = theme === "light";

  return (
    <Button
      aria-label="Toggle appearance"
      variant="muted"
      size={compact ? "icon" : "md"}
      icon={isLight ? <Moon size={18} /> : <Sun size={18} />}
      onClick={onToggle}
    >
      {compact ? null : isLight ? "Arc Dark" : "Light"}
    </Button>
  );
}
