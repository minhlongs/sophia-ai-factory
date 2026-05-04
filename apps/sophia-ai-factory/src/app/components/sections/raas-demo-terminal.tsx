"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useRef } from "react";
import { Container } from "@/seed/components/ui/container";
import { SectionHeading } from "@/seed/components/ui/section-heading";
import { FadeInView } from "@/seed/components/ui/fade-in-view";

// Terminal line types
type LineType = "comment" | "command" | "flag" | "response" | "empty";

interface TerminalLine {
  type: LineType;
  text: string;
}

const TERMINAL_LINES: TerminalLine[] = [
  { type: "comment", text: "# Sophia RaaS — AI mission execution" },
  { type: "command", text: "sophia proposal:create --client='Acme Corp'" },
  { type: "response", text: '{"id":"msn_a1b2c3","status":"running","eta":12}' },
  { type: "empty", text: "" },
  { type: "comment", text: "# Generate qualified leads automatically" },
  { type: "command", text: "sophia lead:generate --niche='SaaS' --count=50" },
  { type: "response", text: '{"leads":50,"qualified":37,"score":0.94}' },
  { type: "empty", text: "" },
  { type: "comment", text: "# Create video content for your brand" },
  { type: "command", text: "sophia video:create --script='auto' --voice='en-US'" },
  { type: "flag", text: "  → Rendering 1080p video... done in 8s" },
  { type: "response", text: '{"url":"https://cdn.sophia.ai/v/out_9x8y.mp4"}' },
  { type: "empty", text: "" },
  { type: "comment", text: "# All 17 commands available via API + Telegram" },
];

const COLOR_MAP: Record<LineType, string> = {
  comment: "text-slate-500",
  command: "text-green-400",
  flag: "text-sky-300",
  response: "text-amber-300",
  empty: "",
};

/** Animated terminal that reveals lines one by one */
function AnimatedTerminal() {
  const [visibleCount, setVisibleCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted.current) {
          hasStarted.current = true;
          let i = 0;
          const tick = () => {
            if (i < TERMINAL_LINES.length) {
              i++;
              setVisibleCount(i);
              setTimeout(tick, TERMINAL_LINES[i - 1].type === "empty" ? 80 : 240);
            }
          };
          tick();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-2xl mx-auto">
      {/* Window chrome */}
      <div className="bg-zinc-800 rounded-t-xl px-4 py-3 flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-400/80" />
        <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
        <div className="w-3 h-3 rounded-full bg-green-400/80" />
        <span className="ml-3 text-xs text-zinc-400 font-mono">sophia-cli</span>
      </div>
      {/* Code body */}
      <div className="bg-zinc-900 rounded-b-xl p-5 font-mono text-[13px] leading-6 overflow-x-auto border border-zinc-700/50 border-t-0 min-h-[260px]">
        {TERMINAL_LINES.slice(0, visibleCount).map((line, i) => (
          <div key={i} className={COLOR_MAP[line.type]}>
            {line.type === "command" && (
              <span className="text-zinc-500 mr-2 select-none">$</span>
            )}
            {line.text}
            {/* Blinking cursor on last visible line */}
            {i === visibleCount - 1 && visibleCount < TERMINAL_LINES.length && (
              <span className="inline-block w-2 h-4 bg-green-400 ml-0.5 motion-safe:animate-pulse align-text-bottom" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RaasDemoTerminal() {
  const t = useTranslations("landing.raas");

  return (
    <section className="py-20 md:py-32 relative overflow-hidden bg-black/30">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(var(--neon-cyan) 1px, transparent 1px), linear-gradient(90deg, var(--neon-cyan) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <Container>
        <SectionHeading
          title={t("terminal.title")}
          subtitle={t("terminal.subtitle")}
        />

        <FadeInView duration={600}>
          <AnimatedTerminal />
        </FadeInView>

        {/* CTA below terminal */}
        <FadeInView delay={400} direction="none">
          <p className="text-center text-sm text-muted-foreground mt-8">
            {t("terminal.cta")}
          </p>
        </FadeInView>
      </Container>
    </section>
  );
}
