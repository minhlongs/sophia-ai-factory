"use client";

import { useRef, useEffect, useState } from "react";

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Delay in ms before animation begins after element enters viewport */
  delay?: number;
  /** IntersectionObserver threshold — 0 to 1 */
  threshold?: number;
}

/**
 * Wraps children with a fade-in-up reveal triggered when the element
 * scrolls into the viewport. Uses IntersectionObserver for performance.
 */
export function ScrollReveal({ children, delay = 0, threshold = 0.15 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          // Unobserve after first reveal — no repeated animations
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(2rem)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
