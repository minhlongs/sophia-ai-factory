"use client";
import { motion } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/app/lib/utils";

interface FadeInProps {
  children?: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  className?: string;
  viewport?: { once?: boolean; margin?: string; amount?: number | "some" | "all" };
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  direction = "up",
  className,
  viewport = { once: true, margin: "-50px" }
}: FadeInProps) {
  const ref = useRef(null);

  const getInitial = () => {
    switch (direction) {
      case "up": return { opacity: 0, y: 30 };
      case "down": return { opacity: 0, y: -30 };
      case "left": return { opacity: 0, x: 30 };
      case "right": return { opacity: 0, x: -30 };
      case "none": return { opacity: 0 };
      default: return { opacity: 0, y: 30 };
    }
  };

  const getAnimate = () => {
    switch (direction) {
      case "up": case "down": return { opacity: 1, y: 0 };
      case "left": case "right": return { opacity: 1, x: 0 };
      case "none": return { opacity: 1 };
      default: return { opacity: 1, y: 0 };
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={getInitial()}
      whileInView={getAnimate()}
      viewport={viewport}
      transition={{
        duration,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98] // Smooth easeOutCubic-ish
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
