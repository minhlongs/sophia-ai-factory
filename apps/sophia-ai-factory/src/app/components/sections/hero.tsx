"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/seed/components/ui/button";
import { TerminalPreview } from "@/app/components/ui/terminal-preview";

const rotatingCommands = [
  "video:create",
  "content:write",
  "lead:generate",
  "campaign:launch",
  "subtitle:generate",
];

function TypingRotator() {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const word = rotatingCommands[index];
    const speed = isDeleting ? 40 : 70;

    if (!isDeleting && displayed === word) {
      const pause = setTimeout(() => setIsDeleting(true), 2000);
      return () => clearTimeout(pause);
    }
    if (isDeleting && displayed === "") {
      setIsDeleting(false);
      setIndex((i) => (i + 1) % rotatingCommands.length);
      return;
    }

    const timer = setTimeout(() => {
      setDisplayed(
        isDeleting
          ? word.slice(0, displayed.length - 1)
          : word.slice(0, displayed.length + 1)
      );
    }, speed);
    return () => clearTimeout(timer);
  }, [displayed, isDeleting, index]);

  return (
    <span className="font-mono text-neon-cyan">
      {displayed}
      <span className="animate-blink text-neon-cyan/70">|</span>
    </span>
  );
}

export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-16">
      {/* Gradient orbs — 2 orbs for ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/5 w-[500px] h-[500px] rounded-full blur-[120px] animate-float bg-neon-cyan/[0.07]" />
        <div className="absolute bottom-1/4 right-1/5 w-[400px] h-[400px] rounded-full blur-[100px] animate-float-delayed bg-neon-purple/[0.08]" />
      </div>

      {/* Dot grid overlay */}
      <div className="absolute inset-0 opacity-[0.04] dot-grid-overlay" aria-hidden="true" />

      <div className="relative container mx-auto px-4 pt-12 pb-20 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 mb-10 text-sm font-medium rounded-full border backdrop-blur-md animate-fade-in-up bg-white/[0.04] border-neon-cyan/15 text-neon-cyan">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-glow-pulse" />
            {t("badge")}
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-6xl lg:text-[4.5rem] font-extrabold mb-4 tracking-tight leading-[1.08] animate-fade-in-up text-foreground"
            style={{ animationDelay: "0.1s" }}
          >
            {t("title_1")}
            <span className="block text-gradient mt-1 drop-shadow-[0_0_30px_rgba(0,240,255,0.15)]">{t("title_2")}</span>
          </h1>

          {/* Dynamic command display */}
          <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <span className="text-muted-foreground text-lg">{t("cmd_prefix")} </span>
            <TypingRotator />
            <span className="text-muted-foreground text-lg"> {t("cmd_suffix")}</span>
          </div>

          {/* Subtitle */}
          <p
            className="text-base md:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            {t("subtitle")}
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            <Link href="/dashboard">
              <Button variant="glow" size="lg" className="glow-primary rounded-full px-8 text-base w-full sm:w-auto shadow-lg shadow-neon-cyan/20">
                {t("cta_start")}
              </Button>
            </Link>
            <Link href="/redeem">
              <Button variant="outline" size="lg" className="rounded-full px-8 text-base w-full sm:w-auto">
                {t("cta_have_code")}
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-8 text-base w-full sm:w-auto"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {t("cta_demo")}
            </Button>
          </div>

          {/* Terminal preview */}
          <div className="mt-16 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <TerminalPreview />
          </div>

          {/* Trust indicators */}
          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-slate-400/50 animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400/60" />
              {t("trust_uptime")}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-cyan/70" />
              {t("trust_response")}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              {t("trust_security")}
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-purple/80" />
              {t("trust_edge")}
            </span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 motion-safe:animate-bounce-slow" aria-hidden="true">
        <div className="w-6 h-10 border-2 rounded-full flex items-start justify-center p-2 border-neon-cyan/20">
          <div className="w-1 h-3 rounded-full bg-neon-cyan/40" />
        </div>
      </div>
    </section>
  );
}
