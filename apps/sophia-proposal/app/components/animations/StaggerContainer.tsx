"use client";
import { motion, Variants } from "framer-motion";
import { cn } from "@/app/lib/utils";

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  staggerChildren?: number;
  viewport?: { once?: boolean; margin?: string };
}

export function StaggerContainer({
  children,
  className,
  delay = 0,
  staggerChildren = 0.1,
  viewport = { once: true, margin: "-50px" }
}: StaggerContainerProps) {
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: staggerChildren,
        delayChildren: delay,
      },
    },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={viewport}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.21, 0.47, 0.32, 0.98]
    }
  },
};
