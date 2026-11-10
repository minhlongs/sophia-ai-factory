"use client";

import { useEffect, useState, type ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps page content with a factory-floor "slide-in" enter animation.
 * Uses Zen Motion Governance CSS tokens (`--motion-duration-deliberate`, `--motion-ease-emphasized`)
 * and respects `prefers-reduced-motion: reduce`.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setMounted(true);
      return;
    }
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={className}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "none" : "translateY(12px)",
        transition:
          "opacity var(--motion-duration-deliberate, 400ms) var(--motion-ease-emphasized, cubic-bezier(0.16,1,0.3,1)), transform var(--motion-duration-deliberate, 400ms) var(--motion-ease-emphasized, cubic-bezier(0.16,1,0.3,1))",
      }}
    >
      {children}
    </div>
  );
}
