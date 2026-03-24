"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const stats = [
  { value: 500, suffix: "+", label: "Missions Completed", icon: "rocket_launch" },
  { value: 50, suffix: "+", label: "Agencies", icon: "groups" },
  { value: 99.9, suffix: "%", label: "Uptime", icon: "check_circle" },
  { value: 2, prefix: "< ", suffix: "s", label: "Response Time", icon: "speed" },
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
    quote: "Sophia cut our proposal turnaround from 3 days to under 30 minutes. Our close rate jumped 40% in the first quarter.",
    rating: 5,
  },
  {
    initials: "SL",
    name: "Sophia Lin",
    company: "BrightWave Studios",
    quote: "The API integration was seamless. We pipe Sophia directly into our CRM and every client touchpoint is now automated.",
    rating: 5,
  },
  {
    initials: "DK",
    name: "David Kwon",
    company: "NorthBridge Consulting",
    quote: "We scaled from 5 to 50 clients without adding headcount. Sophia handles the content layer completely.",
    rating: 5,
  },
];

export function SocialProofSection() {
  return (
    <section className="py-28 bg-surface-container-low">
      <div className="container mx-auto px-4">
        {/* Stats bar — dark contrast strip */}
        <ScrollReveal>
          <div className="rounded-3xl bg-gradient-to-r from-[#060d16] to-surface-dark p-10 md:p-12 mb-24 relative overflow-hidden">
            {/* Subtle gradient orb */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 stagger-reveal">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="w-10 h-10 rounded-xl bg-on-surface-dark/8 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-lg text-inverse-primary/60">{stat.icon}</span>
                  </div>
                  <p className="text-3xl md:text-4xl font-extrabold text-on-surface-dark mb-1 tracking-tight">
                    <AnimatedCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </p>
                  <p className="text-on-surface-dark-variant text-sm font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Section heading */}
        <ScrollReveal className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/5 rounded-full border border-primary/10">
            <span className="material-symbols-outlined text-sm">format_quote</span>
            Testimonials
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-on-surface mb-5 tracking-tight">
            Trusted by{" "}
            <span className="text-primary">Leading Agencies</span>
          </h2>
          <p className="text-lg text-on-surface-variant max-w-xl mx-auto leading-relaxed">
            Real results from teams who switched to Sophia AI Factory
          </p>
        </ScrollReveal>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 100}>
              <div className="gradient-border h-full cursor-pointer group">
                <div className="p-6 rounded-[16px] bg-surface-container-lowest h-full flex flex-col gap-4">
                  {/* Stars */}
                  <div className="flex gap-0.5">
                    {[...Array(t.rating)].map((_, j) => (
                      <span key={j} className="material-symbols-outlined text-base text-amber-400">star</span>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-on-surface-variant leading-relaxed text-sm flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  {/* Author */}
                  <div className="flex items-center gap-3 pt-3 border-t border-outline-variant/15">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-inverse-primary text-white text-sm font-bold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-on-surface font-semibold text-sm">{t.name}</p>
                      <p className="text-on-surface-variant text-xs">{t.company}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
