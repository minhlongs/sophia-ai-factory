"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const stats = [
  { value: 500, suffix: "+", label: "Missions Completed" },
  { value: 50, suffix: "+", label: "Agencies" },
  { value: 99.9, suffix: "%", label: "Uptime" },
  { value: 2, prefix: "< ", suffix: "s", label: "Response Time" },
];

function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
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
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

const testimonials = [
  {
    initials: "MR",
    name: "Marcus Reed",
    company: "Apex Digital Agency",
    quote:
      "Sophia cut our proposal turnaround from 3 days to under 30 minutes. Our close rate jumped 40% in the first quarter.",
  },
  {
    initials: "SL",
    name: "Sophia Lin",
    company: "BrightWave Studios",
    quote:
      "The API integration was seamless. We pipe Sophia directly into our CRM and every client touchpoint is now automated.",
  },
  {
    initials: "DK",
    name: "David Kwon",
    company: "NorthBridge Consulting",
    quote:
      "We scaled from 5 to 50 clients without adding headcount. Sophia handles the content layer completely.",
  },
];

export function SocialProofSection() {
  return (
    <section className="py-24 bg-surface">
      <div className="container mx-auto px-4">
        {/* Stats bar — dark contrast strip */}
        <div className="rounded-3xl bg-gradient-to-r from-surface-dark-dim to-surface-dark p-8 md:p-10 mb-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-on-surface-dark mb-1 tracking-tight">
                  <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </p>
                <p className="text-on-surface-dark-variant text-sm font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section heading */}
        <ScrollReveal className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 mb-4 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full">
            Social Proof
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-on-surface mb-4 tracking-tight">
            Trusted by Leading Agencies
          </h2>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Real results from teams who switched to Sophia AI Factory
          </p>
        </ScrollReveal>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="p-6 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 card-hover flex flex-col gap-4"
            >
              {/* Stars */}
              <div className="flex gap-0.5 text-amber-400 text-sm">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-lg">star</span>
                ))}
              </div>
              {/* Quote */}
              <p className="text-on-surface-variant leading-relaxed text-sm flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>
              {/* Author */}
              <div className="flex items-center gap-3 pt-2 border-t border-outline-variant/20">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-inverse-primary text-on-surface-dark text-sm font-bold flex items-center justify-center flex-shrink-0"
                  aria-label={`Avatar for ${t.name}`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-on-surface font-semibold text-sm">{t.name}</p>
                  <p className="text-on-surface-variant text-xs">{t.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
