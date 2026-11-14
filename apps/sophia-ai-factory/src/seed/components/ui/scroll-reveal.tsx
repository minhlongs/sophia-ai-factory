"use client";

import { useRef, useEffect, useState, Children, isValidElement, cloneElement } from "react";
import { prefersReducedMotion } from "./fade-in-view";

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Delay in ms before animation begins after element enters viewport */
  delay?: number;
  /** IntersectionObserver threshold — 0 to 1 */
  threshold?: number;
  /** Optional Tailwind/CSS class names */
  className?: string;
  /** Stagger delay between children in ms (enables per-child reveal) */
  staggerDelay?: number;
}

/**
 * Wraps children with a fade-in-up reveal triggered when the element
 * scrolls into the viewport. Uses IntersectionObserver + Zen Motion Governance tokens.
 */
export function ScrollReveal({
  children,
  delay = 0,
  threshold = 0.05,
  className,
  staggerDelay,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Deterministic SSR + hydration initial state; CSS `@media (prefers-reduced-motion: reduce)`
  // on `[data-zen-motion]` and `[data-zen-motion-stagger] > *` guarantees visible SSR paint.
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const syncReduced = () => {
      const nextReduced = prefersReducedMotion();
      setReduced(nextReduced);
      if (nextReduced) {
        setVisible(true);
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

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      mql?.removeEventListener?.("change", syncReduced);
    };
  }, [threshold]);

  const easing = "var(--motion-ease-emphasized, cubic-bezier(0.16, 1, 0.3, 1))";
  const duration = "var(--motion-duration-cinematic, 600ms)";

  if (staggerDelay && visible) {
    const childArray = Children.toArray(children);
    return (
      <div ref={ref} className={className} data-zen-motion-stagger="" data-zen-revealed="true">
        {childArray.map((child, i) => {
          if (!isValidElement(child)) return child;
          const existingStyle = (child.props as { style?: React.CSSProperties }).style ?? {};
          return cloneElement(child, {
            style: {
              ...existingStyle,
              opacity: 1,
              transform: "none",
              transition: reduced
                ? "none"
                : `opacity ${duration} ${easing} ${delay + i * staggerDelay}ms, transform ${duration} ${easing} ${delay + i * staggerDelay}ms`,
            },
          } as { style: React.CSSProperties });
        })}
      </div>
    );
  }

  if (staggerDelay && !visible) {
    const childArray = Children.toArray(children);
    return (
      <div ref={ref} className={className} data-zen-motion-stagger="" data-zen-revealed="false">
        {childArray.map((child, i) => {
          if (!isValidElement(child)) return child;
          const existingStyle = (child.props as { style?: React.CSSProperties }).style ?? {};
          return cloneElement(child, {
            style: {
              ...existingStyle,
              opacity: 0,
              transform: "translateY(1.5rem)",
              transition: `opacity ${duration} ${easing} ${delay + i * staggerDelay}ms, transform ${duration} ${easing} ${delay + i * staggerDelay}ms`,
            },
          } as { style: React.CSSProperties });
        })}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={className}
      data-zen-motion="scroll-reveal"
      data-zen-revealed={visible ? "true" : "false"}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(2rem)",
        transition: reduced ? "none" : `opacity ${duration} ${easing} ${delay}ms, transform ${duration} ${easing} ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
