"use client";

import { useEffect, useState, type ReactNode } from "react";
import { prefersReducedMotion } from "./fade-in-view";

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
  const reduced = prefersReducedMotion();
  const [mounted, setMounted] = useState(reduced);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setMounted(true);
      return;
    }
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={className}
      data-zen-motion="page-transition"
      data-zen-revealed={mounted ? "true" : "false"}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "none" : "translateY(12px)",
        transition: reduced
          ? "none"
          : "opacity var(--motion-duration-deliberate, 400ms) var(--motion-ease-emphasized, cubic-bezier(0.16,1,0.3,1)), transform var(--motion-duration-deliberate, 400ms) var(--motion-ease-emphasized, cubic-bezier(0.16,1,0.3,1))",
      }}
    >
      {children}
    </div>
  );
}
