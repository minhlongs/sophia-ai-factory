"use client";

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./fade-in-view";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
}

/**
 * A lightweight animated counter that doesn't depend on framer-motion.
 * Optimized for performance as part of the Sophia AI Factory performance audit.
 *
 * Respects `prefers-reduced-motion: reduce` — when the operating system asks
 * for reduced motion, the counter jumps straight to the final value without an
 * animation loop.
 */
export function AnimatedCounter({ value, duration = 1500 }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let animationFrameId = 0;

    const applyReduced = () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      setReducedMotion(true);
      setCount(value);
    };

    if (mql?.matches || prefersReducedMotion()) {
      applyReduced();
    } else {
      setReducedMotion(false);
      let startTimestamp: number | null = null;

      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);

        // Easing function: easeOutExpo
        const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

        setCount(Math.floor(easedProgress * value));

        if (progress < 1) {
          animationFrameId = window.requestAnimationFrame(step);
        } else {
          animationFrameId = 0;
        }
      };

      animationFrameId = window.requestAnimationFrame(step);
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        applyReduced();
      } else {
        setReducedMotion(false);
      }
    };

    if (mql) {
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", handleChange);
      } else if (typeof mql.addListener === "function") {
        mql.addListener(handleChange);
      }
    }

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (mql) {
        if (typeof mql.removeEventListener === "function") {
          mql.removeEventListener("change", handleChange);
        } else if (typeof mql.removeListener === "function") {
          mql.removeListener(handleChange);
        }
      }
    };
  }, [value, duration]);

  return (
    <span
      data-zen-motion="animated-counter"
      data-zen-reduced={reducedMotion ? "true" : "false"}
    >
      {count.toLocaleString()}
    </span>
  );
}
