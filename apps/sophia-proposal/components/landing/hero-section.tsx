"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TerminalPreview } from "./terminal-preview";

const rotatingCommands = [
  "proposal:create",
  "lead:generate",
  "email:send",
  "content:write",
  "sales:battlecard",
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
        isDeleting ? word.slice(0, displayed.length - 1) : word.slice(0, displayed.length + 1)
      );
    }, speed);
    return () => clearTimeout(timer);
  }, [displayed, isDeleting, index]);

  return (
    <span className="text-inverse-primary font-mono">
      {displayed}
      <span className="animate-blink text-inverse-primary/60">|</span>
    </span>
  );
}

export function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#060d16] via-surface-dark to-[#0a1929]">
      {/* Animated gradient orbs — larger, more vivid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/5 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/5 w-[400px] h-[400px] bg-inverse-primary/10 rounded-full blur-[100px] animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/8 rounded-full blur-[150px] animate-drift" />
      </div>

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative container mx-auto px-4 pt-28 pb-20 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 mb-10 text-sm font-medium bg-on-surface-dark/8 text-inverse-primary/90 rounded-full border border-inverse-primary/15 backdrop-blur-sm animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-glow-pulse" />
            Robot-as-a-Service Platform
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-extrabold text-on-surface-dark mb-4 tracking-tight leading-[1.08] animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            AI Agents That
            <span className="block text-gradient mt-1">Execute & Deliver</span>
          </h1>

          {/* Dynamic command display */}
          <div className="mb-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
            <span className="text-on-surface-dark-variant text-lg">
              Run{" "}
            </span>
            <TypingRotator />
            <span className="text-on-surface-dark-variant text-lg">
              {" "}in seconds
            </span>
          </div>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-on-surface-dark-variant/80 mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            Deploy autonomous AI missions via API. Proposal generation, lead hunting,
            email outreach — all powered by MCU credits with transparent pricing.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <Button
              variant="primary"
              size="lg"
              className="glow-primary cursor-pointer rounded-full px-8 text-base"
              onClick={() => router.push("/signup")}
            >
              <span className="material-symbols-outlined text-lg mr-2">rocket_launch</span>
              Start Free — 200 MCU
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-on-surface-dark/20 text-on-surface-dark hover:bg-on-surface-dark/10 cursor-pointer rounded-full px-8 text-base"
              onClick={() => router.push("/docs/api")}
            >
              <span className="material-symbols-outlined text-lg mr-2">code</span>
              API Docs
            </Button>
          </div>

          {/* Terminal preview */}
          <div className="animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
            <TerminalPreview />
          </div>

          {/* Trust indicators */}
          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-on-surface-dark-variant/40 text-sm animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-green-400/60">verified</span>
              99.9% Uptime SLA
            </span>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-blue-400/60">speed</span>
              Sub-2s Response
            </span>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-amber-400/60">lock</span>
              Enterprise Security
            </span>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-purple-400/60">deployed_code</span>
              250+ Edge Nodes
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
