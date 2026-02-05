"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="text" size="icon" className="w-10 h-10 rounded-full">
        <span className="material-symbols-rounded">light_mode</span>
      </Button>
    );
  }

  return (
    <Button
      variant="text"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-10 h-10 rounded-full hover:bg-on-surface/8 active:bg-on-surface/12"
      aria-label="Toggle theme"
    >
      <span className="material-symbols-rounded">
        {theme === "dark" ? "dark_mode" : "light_mode"}
      </span>
    </Button>
  );
}
