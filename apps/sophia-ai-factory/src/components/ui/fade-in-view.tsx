"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

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
 * Lightweight replacement for framer-motion's whileInView pattern.
 * Uses IntersectionObserver + CSS transitions instead of ~35KB JS library.
 */
export function FadeInView({
  children,
  className = "",
  delay = 0,
  direction = "up",
  distance = 20,
  duration = 500,
  once = true,
  rootMargin = "0px",
  as: Tag = "div",
}: FadeInViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

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
    return () => observer.disconnect();
  }, [once, rootMargin]);

  const translateMap = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
    none: "none",
  };

  const style: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "none" : translateMap[direction],
    transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
    willChange: "opacity, transform",
  };

  return (
    // @ts-expect-error -- dynamic tag
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
