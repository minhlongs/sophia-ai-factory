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
  // Deterministic SSR + hydration initial state (`false`) avoids React 19 hydration
  // mismatch when OS `prefers-reduced-motion: reduce` is enabled; CSS `@media` rule
  // on `[data-zen-motion]` keeps SSR markup visually revealed from byte 0.
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const syncReduced = () => {
      const nextReduced = prefersReducedMotion();
      setReduced(nextReduced);
      if (nextReduced) {
        setMounted(true);
      }
      return nextReduced;
    };

    const mql =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    mql?.addEventListener?.("change", syncReduced);

    if (syncReduced()) {
      return () => mql?.removeEventListener?.("change", syncReduced);
    }

    const frame = requestAnimationFrame(() => setMounted(true));
    return () => {
      cancelAnimationFrame(frame);
      mql?.removeEventListener?.("change", syncReduced);
    };
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
