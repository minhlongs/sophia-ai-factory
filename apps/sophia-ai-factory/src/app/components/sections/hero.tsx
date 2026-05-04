"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
    <span className="font-mono" style={{ color: "var(--neon-cyan)" }}>
      {displayed}
      <span className="animate-blink" style={{ color: "var(--neon-cyan)", opacity: 0.7 }}>|</span>
    </span>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background pt-16">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-1/4 left-1/5 w-[500px] h-[500px] rounded-full blur-[120px] animate-float"
          style={{ background: "var(--neon-cyan)", opacity: 0.07 }}
        />
        <div
          className="absolute bottom-1/4 right-1/5 w-[400px] h-[400px] rounded-full blur-[100px] animate-float-delayed"
          style={{ background: "var(--neon-purple)", opacity: 0.08 }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[150px] animate-drift"
          style={{ background: "var(--neon-cyan)", opacity: 0.04 }}
        />
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

      <div className="relative container mx-auto px-4 pt-12 pb-20 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 mb-10 text-sm font-medium rounded-full border backdrop-blur-sm animate-fade-in-up"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderColor: "rgba(0,240,255,0.15)",
              color: "var(--neon-cyan)",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-glow-pulse" />
            Video Factory + AI Automation
          </div>

          {/* Headline */}
          <h1
            className="text-5xl md:text-6xl lg:text-[4.5rem] font-extrabold mb-4 tracking-tight leading-[1.08] animate-fade-in-up text-foreground"
            style={{ animationDelay: "0.1s" }}
          >
            Tự Động Hóa Nội Dung
            <span className="block text-gradient mt-1">Một Nền Tảng</span>
          </h1>

          {/* Dynamic command display */}
          <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <span className="text-muted-foreground text-lg">Chạy </span>
            <TypingRotator />
            <span className="text-muted-foreground text-lg"> trong vài giây</span>
          </div>

          {/* Subtitle */}
          <p
            className="text-base md:text-lg text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "0.3s" }}
          >
            Tạo video AI, tìm kiếm lead, gửi chiến dịch — tất cả tự động hóa.
            Triển khai AI missions qua API với giá minh bạch theo MCU credits.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            <Link href="/dashboard">
              <Button variant="glow" size="lg" className="glow-primary rounded-full px-8 text-base w-full sm:w-auto">
                Bắt Đầu Miễn Phí
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
              Tìm Hiểu Thêm
            </Button>
          </div>

          {/* Terminal preview */}
          <div className="animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            <TerminalPreview />
          </div>

          {/* Trust indicators */}
          <div
            className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm animate-fade-in-up"
            style={{ animationDelay: "0.6s", color: "rgba(148,163,184,0.5)" }}
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400/60" />
              99.9% Uptime SLA
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--neon-cyan)", opacity: 0.7 }} />
              Phản Hồi Dưới 2 Giây
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400/60" />
              Bảo Mật Doanh Nghiệp
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--neon-purple)", opacity: 0.8 }} />
              250+ Edge Nodes
            </span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 motion-safe:animate-bounce-slow" aria-hidden="true">
        <div className="w-6 h-10 border-2 rounded-full flex items-start justify-center p-2" style={{ borderColor: "rgba(0,240,255,0.2)" }}>
          <div className="w-1 h-3 rounded-full" style={{ background: "rgba(0,240,255,0.4)" }} />
        </div>
      </div>
    </section>
  );
}
