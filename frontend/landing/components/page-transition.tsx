"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * PageTransition wraps page content with a fade + slide-up animation
 * using framer-motion AnimatePresence. Each route change triggers
 * the exit/enter animation cycle.
 */
export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
