"use client";

import React, { useRef, useEffect, useState, type ReactNode } from "react";

interface FadeInViewProps {
  children: ReactNode;
  className?: string;
  /** Delay in ms before animation starts after becoming visible */
  delay?: number;
  /** Animation direction: up (default), down, left, right, none (fade only) */
  direction?: "up" | "down" | "left" | "right" | "none";
  /** Distance in px for the slide animation */
  distance?: number;
  /** Duration in ms */
  duration?: number;
  /** Whether to only animate once */
  once?: boolean;
  /** Root margin for IntersectionObserver */
  rootMargin?: string;
  /** HTML tag to render */
  as?: keyof HTMLElementTagNameMap;
}

/**
 * Lightweight zero-dependency viewport entrance primitive.
 * Governed by Zen Motion Governance (`--motion-ease-emphasized` + reduced-motion guard).
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function FadeInView({
  children,
  className = "",
  delay = 0,
  direction = "up",
  distance = 20,
  duration = 400,
  once = true,
  rootMargin = "0px",
  as: tag = "div",
}: FadeInViewProps) {
  const ref = useRef<HTMLElement>(null);
  // Deterministic initial state (`false`) on both SSR and client hydration pass
  // prevents React 19 hydration mismatches; `@media (prefers-reduced-motion: reduce)`
  // in `globals.css` guarantees `[data-zen-motion]` stays `opacity: 1; transform: none`
  // from byte 0 of SSR, and `useEffect` immediately promotes `reduced` + `isVisible`.
  const [isVisible, setIsVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const syncReduced = () => {
      const nextReduced = prefersReducedMotion();
      setReduced(nextReduced);
      if (nextReduced) {
        setIsVisible(true);
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

    const element = ref.current;
    if (!element) {
      return () => mql?.removeEventListener?.("change", syncReduced);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(element);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold: 0.1 }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      mql?.removeEventListener?.("change", syncReduced);
    };
  }, [once, rootMargin]);

  const directions = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
    none: "none",
  };

  const Tag = tag as React.ElementType;
  const easing = "var(--motion-ease-emphasized, cubic-bezier(0.16, 1, 0.3, 1))";

  return (
    <Tag
      ref={ref}
      className={className}
      data-zen-motion="fade-in-view"
      data-zen-revealed={isVisible ? "true" : "false"}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : directions[direction],
        transition: reduced
          ? "none"
          : `opacity ${duration}ms ${easing} ${delay}ms, transform ${duration}ms ${easing} ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </Tag>
  );
}
