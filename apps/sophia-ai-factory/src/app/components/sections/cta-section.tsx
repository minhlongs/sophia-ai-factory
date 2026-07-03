"use client";

import { Link } from "@/navigation";
import { Button } from "@/seed/components/ui/button";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";

/** Premium CTA section with glow orbs and dot pattern — dark themed */
export function CtaSection() {
  return (
    <section className="py-28">
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <div
            className="relative max-w-4xl mx-auto rounded-lg p-12 md:p-16 text-center overflow-hidden border border-zinc-800"
            style={{
              background: "linear-gradient(135deg, #0F0F11 0%, #18181B 50%, #0F0F11 100%)",
            }}
          >
            {/* Decorative orbs */}
            <div
              className="absolute top-0 left-0 w-72 h-72 rounded-full blur-[100px] pointer-events-none"
              style={{ background: "#6366F1", opacity: 0.12 }}
              aria-hidden="true"
            />
            <div
              className="absolute bottom-0 right-0 w-56 h-56 rounded-full blur-[80px] pointer-events-none"
              style={{ background: "#6366F1", opacity: 0.1 }}
              aria-hidden="true"
            />

            {/* Dot pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              aria-hidden="true"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-5 tracking-tight leading-tight">
                Sẵn Sàng Tự Động Hóa
                <span className="block bg-gradient-to-r from-indigo-400 to-indigo-600 bg-clip-text text-transparent mt-1">Agency Của Bạn?</span>
              </h2>
              <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
                Tham gia 50+ agency đang dùng Sophia AI Factory.
                Bắt đầu với 200 MCU credits miễn phí — không cần thẻ tín dụng.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/dashboard">
                  <Button
                    variant="glow"
                    size="lg"
                    className="rounded-lg px-10 text-base w-full sm:w-auto"
                  >
                    Bắt Đầu Miễn Phí
                  </Button>
                </Link>
                <Link href="/guide">
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-lg px-10 text-base w-full sm:w-auto"
                    style={{ borderColor: "rgba(255,255,255,0.15)" }}
                  >
                    Đọc Hướng Dẫn
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
