"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const HERO_SCROLL_THRESHOLD = 600;

export function StickyMobileCta() {
  const [visible, setVisible] = useState(false);
  const pricingRef = useRef<Element | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > HERO_SCROLL_THRESHOLD);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const pricingEl = document.querySelector("#pricing");
    if (!pricingEl) return;

    pricingRef.current = pricingEl;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(false);
      },
      { rootMargin: "0px 0px -20% 0px" },
    );

    observer.observe(pricingEl);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 pb-4 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.12)] bg-surface border-t border-outline/10">
      <Link
        href="/signup"
        className="inline-flex items-center justify-center w-full rounded-full font-medium bg-primary text-on-primary hover:bg-primary-hover transition-colors focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none px-8 py-4 text-lg h-14 cursor-pointer text-base"
      >
        Start Free →
      </Link>
    </div>
  );
}
