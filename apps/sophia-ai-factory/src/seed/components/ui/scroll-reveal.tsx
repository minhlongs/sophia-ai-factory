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
  const reduced = prefersReducedMotion();
  // Visible from the first frame under reduced motion — never a hidden start.
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
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
    return () => observer.disconnect();
  }, [threshold]);

  const easing = "var(--motion-ease-emphasized, cubic-bezier(0.16, 1, 0.3, 1))";
  const duration = "var(--motion-duration-cinematic, 600ms)";

  if (staggerDelay && visible) {
    const childArray = Children.toArray(children);
    return (
      <div ref={ref} className={className}>
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
      <div ref={ref} className={className}>
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
