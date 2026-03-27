"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const HERO_SCROLL_THRESHOLD = 600;

/** Floating CTA bar shown on mobile after scrolling past the hero */
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
      { rootMargin: "0px 0px -20% 0px" }
    );

    observer.observe(pricingEl);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 pb-4 pt-3 border-t"
      style={{
        background: "rgba(2,8,23,0.97)",
        borderColor: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Link
        href="/dashboard"
        className="inline-flex items-center justify-center w-full rounded-full font-medium text-white transition-all focus:ring-2 focus:outline-none px-8 py-4 text-base h-14 cursor-pointer glow-primary"
        style={{
          background: "linear-gradient(to right, var(--neon-cyan), var(--neon-purple))",
        }}
      >
        Bắt Đầu Miễn Phí &rarr;
      </Link>
    </div>
  );
}
