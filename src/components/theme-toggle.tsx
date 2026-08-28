"use client";

import { useTheme } from "./theme-provider";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-7 w-12" />; // avoid hydration mismatch
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="theme-switch" title={`Switch to ${theme === "dark" ? "Light (Beige & Green)" : "Dark (Obsidian & Amber)"} Mode`}>
        <input
          type="checkbox"
          checked={theme === "dark"}
          onChange={toggleTheme}
        />
        <span className="theme-slider" />
      </label>
    </div>
  );
}
