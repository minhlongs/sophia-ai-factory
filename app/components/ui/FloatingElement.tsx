import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/app/lib/utils";

interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  depth?: number; // 1 = closest/fastest, 5 = furthest/slowest
  duration?: number;
  delay?: number;
}

export const FloatingElement = ({
  children,
  className,
  depth = 1,
  duration = 6,
  delay = 0,
}: FloatingElementProps) => {
  return (
    <motion.div
      className={cn("absolute", className)}
      animate={{
        y: [0, -20 / depth, 0],
      }}
      transition={{
        duration: duration * depth,
        repeat: Infinity,
        ease: "easeInOut",
        delay: delay,
      }}
    >
      {children}
    </motion.div>
  );
};
