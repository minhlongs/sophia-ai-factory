"use client";

import { motion, useSpring, useTransform, useInView } from "framer-motion";
import { useEffect, useRef } from "react";
import { formatNumber } from "@/app/lib/utils";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export const AnimatedCounter = ({ value, prefix = "", suffix = "", className }: AnimatedCounterProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 75,
    damping: 15,
  });

  const display = useTransform(spring, (current) => {
    return `${prefix}${formatNumber(Math.round(current))}${suffix}`;
  });

  useEffect(() => {
    if (inView) {
      spring.set(value);
    }
  }, [spring, value, inView]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
};
