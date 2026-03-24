"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TerminalPreview } from "./terminal-preview";

export function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#0d2847] to-[#051a2f] animate-gradient">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0061a4]/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#5ec9ff]/15 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0061a4]/10 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <span className="inline-block px-5 py-2 mb-8 text-sm font-semibold bg-white/10 text-[#5ec9ff] rounded-full border border-[#5ec9ff]/20 backdrop-blur-sm">
            Robot-as-a-Service for Digital Agencies
          </span>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 tracking-tight leading-[1.1]">
            Build AI Workflows
            <span className="block text-gradient mt-2">That Scale</span>
          </h1>
          <p className="text-lg md:text-xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed">
            Deploy autonomous AI agents in minutes. From proposal generation to content
            automation — powered by MCU credits with predictable pricing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              variant="primary"
              size="lg"
              className="glow-primary cursor-pointer"
              onClick={() => router.push("/signup")}
            >
              Start Free — 200 MCU
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-white/20 text-white hover:bg-white/10 cursor-pointer"
              onClick={() => router.push("#pricing")}
            >
              View Pricing
            </Button>
          </div>
          {/* Terminal preview */}
          <TerminalPreview />
          {/* Trust indicators */}
          <div className="mt-12 flex items-center justify-center gap-8 text-white/30 text-sm">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">verified</span>
              99.9% Uptime
            </span>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">speed</span>
              Sub-2s Response
            </span>
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base">lock</span>
              Enterprise Security
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
