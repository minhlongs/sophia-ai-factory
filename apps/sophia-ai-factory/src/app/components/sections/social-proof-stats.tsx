"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";

interface StatItem {
  value: number;
  prefix?: string;
  suffix?: string;
  labelKey: string;
  icon: string;
}

const FALLBACK_STATS: StatItem[] = [
  { value: 500, suffix: "+", labelKey: "missions", icon: "rocket_launch" },
  { value: 50, suffix: "+", labelKey: "agencies", icon: "groups" },
  { value: 300, suffix: "+", labelKey: "edge_pops", icon: "public" },
  { value: 2, prefix: "< ", suffix: "s", labelKey: "response_time", icon: "speed" },
];

interface LiveStatsResponse {
  missionsCompleted: number;
  paidAgencies: number;
  videosGenerated: number;
}

function useLiveStats(): StatItem[] {
  const [stats, setStats] = useState<StatItem[]>(FALLBACK_STATS);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/stats/live", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as LiveStatsResponse;
        if (!active) return;
        setStats((prev) => [
          { ...prev[0], value: data.missionsCompleted },
          { ...prev[1], value: data.paidAgencies },
          prev[2],
          prev[3],
        ]);
      } catch {
        // degrade silently to FALLBACK_STATS
      }
    })();
    return () => { active = false; };
  }, []);
  return stats;
}

function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1500;
          const start = performance.now();
          const isDecimal = value % 1 !== 0;
          function tick(now: number) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(isDecimal ? parseFloat((value * eased).toFixed(1)) : Math.floor(value * eased));
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {prefix}{count}{suffix}
    </span>
  );
}

export function StatsBar() {
  const t = useTranslations("landing.social_proof");
  const stats = useLiveStats();

  return (
    <ScrollReveal>
      <div className="rounded-lg p-10 md:p-12 mb-24 relative overflow-hidden bg-section-dark">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] pointer-events-none bg-neon-cyan/[0.07]" aria-hidden="true" />
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 stagger-reveal">
          {stats.map((stat) => (
            <div key={stat.labelKey} className="text-center">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3 bg-muted/30">
                <span className="material-symbols-outlined text-lg text-neon-cyan/70">{stat.icon}</span>
              </div>
              <p className="text-3xl md:text-4xl font-extrabold mb-1 tracking-tight text-foreground">
                <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
              </p>
              <p className="text-muted-foreground text-sm font-medium">{t(`stats.${stat.labelKey}`)}</p>
            </div>
          ))}
        </div>
      </div>
    </ScrollReveal>
  );
}
