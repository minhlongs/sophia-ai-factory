"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";

interface StatItem {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  icon: string;
}

// Defaults shown on first paint. Replaced by live counters from
// /api/stats/live (60s edge-cached) once mounted on the client — see
// useLiveStats() below. The "+" suffix is preserved to flag that the
// numbers are running totals.
const FALLBACK_STATS: StatItem[] = [
  { value: 500, suffix: "+", label: "Missions Hoàn Thành", icon: "rocket_launch" },
  { value: 50, suffix: "+", label: "Agency Tin Dùng", icon: "groups" },
  { value: 300, suffix: "+", label: "Edge PoPs Toàn Cầu", icon: "public" },
  { value: 2, prefix: "< ", suffix: "s", label: "Thời Gian Phản Hồi", icon: "speed" },
];

interface LiveStatsResponse {
  missionsCompleted: number;
  paidAgencies: number;
  videosGenerated: number;
}

/**
 * Pull the live counters once on mount. Read-only; never throws to the UI.
 * Returns the active StatItem[] (fallback first, live overlay if reachable).
 */
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
        // intentional: degrade silently to FALLBACK_STATS
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return stats;
}

const testimonials = [
  {
    initials: "MT",
    name: "Minh Tuấn",
    company: "Apex Digital Agency VN",
    quote: "Sophia giảm thời gian làm video từ 3 ngày xuống còn 30 phút. Tỉ lệ chốt khách hàng tăng 40% ngay quý đầu.",
    rating: 5,
  },
  {
    initials: "HN",
    name: "Hương Nguyễn",
    company: "BrightWave Studios",
    quote: "Tích hợp API cực kỳ mượt. Chúng tôi kết nối Sophia thẳng vào CRM và mọi điểm tiếp xúc khách hàng đều tự động hóa.",
    rating: 5,
  },
  {
    initials: "TL",
    name: "Thành Lê",
    company: "NorthBridge Consulting",
    quote: "Scale từ 5 lên 50 khách hàng mà không cần thêm nhân sự. Sophia xử lý hoàn toàn layer nội dung và video.",
    rating: 5,
  },
];

function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
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
            setCount(
              isDecimal
                ? parseFloat((value * eased).toFixed(1))
                : Math.floor(value * eased)
            );
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
      {prefix}
      {count}
      {suffix}
    </span>
  );
}

export function SocialProof() {
  const stats = useLiveStats();
  return (
    <section className="py-28 relative overflow-hidden">
      {/* Background glows */}
      <div
        className="absolute top-1/2 left-1/3 w-[600px] h-[600px] rounded-full blur-[150px] -z-10"
        style={{ background: "var(--neon-cyan)", opacity: 0.04 }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] -z-10"
        style={{ background: "var(--neon-purple)", opacity: 0.05 }}
      />

      <div className="container mx-auto px-4">
        {/* Stats bar */}
        <ScrollReveal>
          <div
            className="rounded-3xl p-10 md:p-12 mb-24 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #060d16 0%, #0f172a 100%)",
            }}
          >
            {/* Subtle orb */}
            <div
              className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] pointer-events-none"
              style={{ background: "var(--neon-cyan)", opacity: 0.07 }}
              aria-hidden="true"
            />
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 stagger-reveal">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <span
                      className="material-symbols-outlined text-lg"
                      style={{ color: "var(--neon-cyan)", opacity: 0.7 }}
                    >
                      {stat.icon}
                    </span>
                  </div>
                  <p className="text-3xl md:text-4xl font-extrabold mb-1 tracking-tight text-foreground">
                    <AnimatedCounter
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                    />
                  </p>
                  <p className="text-muted-foreground text-sm font-medium">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Section heading */}
        <ScrollReveal className="text-center mb-14">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider rounded-full border"
            style={{
              color: "var(--neon-cyan)",
              background: "rgba(0,240,255,0.05)",
              borderColor: "rgba(0,240,255,0.1)",
            }}
          >
            <span className="material-symbols-outlined text-sm">format_quote</span>
            Đánh Giá Khách Hàng
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
            Được Tin Dùng Bởi{" "}
            <span className="text-gradient">Các Agency Hàng Đầu</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Kết quả thực tế từ các team đã chuyển sang dùng Sophia AI Factory
          </p>
        </ScrollReveal>

        {/* Testimonials */}
        {/* Composite disclosure (2026-05-16 honest pivot) — testimonials are
            composite based on early user research and beta feedback rather
            than verbatim quotes from named individuals. */}
        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 100}>
              <div className="gradient-border h-full cursor-pointer group">
                <div className="p-6 rounded-[16px] bg-card h-full flex flex-col gap-4">
                  {/* Stars */}
                  <div className="flex gap-0.5">
                    {[...Array(t.rating)].map((_, j) => (
                      <span
                        key={`star-${t.name}-${j}`}
                        className="material-symbols-outlined text-base text-amber-400"
                        aria-hidden="true"
                      >
                        star
                      </span>
                    ))}
                  </div>
                  {/* Quote */}
                  <p className="text-muted-foreground leading-relaxed text-sm flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  {/* Author */}
                  <div
                    className="flex items-center gap-3 pt-3 border-t"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300"
                      style={{
                        background: "linear-gradient(135deg, var(--neon-cyan), var(--neon-purple))",
                      }}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-foreground font-semibold text-sm">{t.name}</p>
                      <p className="text-muted-foreground text-xs">{t.company}</p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Honest disclosure */}
        <p className="text-center text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
          Lời chứng thực tổng hợp từ nghiên cứu người dùng và phản hồi beta.
        </p>
      </div>
    </section>
  );
}
