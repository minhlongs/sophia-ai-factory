"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-scrim/40 via-scrim/20 to-surface z-10" />
        {/* Placeholder for actual hero image - using a solid color for now, ideally an image of tea hills */}
        <div className="w-full h-full bg-tertiary animate-pulse-slow" />
      </div>

      <div className="relative z-10 container mx-auto px-6 text-center max-w-4xl pt-20">
        <Typography
          variant="label-large"
          className="text-secondary tracking-[0.2em] uppercase mb-6 animate-fade-in-up"
        >
          Di sản trà Việt
        </Typography>

        <Typography
          variant="display-large"
          className="text-on-tertiary mb-6 font-display font-medium leading-tight animate-fade-in-up delay-100"
        >
          Tinh hoa trà cổ thụ <br />
          <span className="italic text-secondary">ngàn năm tuổi</span>
        </Typography>

        <Typography
          variant="body-large"
          className="text-on-tertiary/90 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up delay-200"
        >
          Hành trình tìm về cội nguồn hương vị từ những cây trà Shan Tuyết cổ thụ
          sống trên đỉnh núi mờ sương, hấp thụ tinh khí đất trời qua hàng thế kỷ.
        </Typography>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
          <Button size="lg" variant="filled" className="min-w-[180px]" asChild>
            <Link href="/products">Khám phá Bộ sưu tập</Link>
          </Button>
          <Button
            size="lg"
            variant="outlined"
            className="min-w-[180px] border-on-tertiary text-on-tertiary hover:bg-on-tertiary/10"
            asChild
          >
            <Link href="/story">Câu chuyện của chúng tôi</Link>
          </Button>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-on-tertiary/50 animate-bounce">
        <span className="material-symbols-rounded">keyboard_arrow_down</span>
      </div>
    </section>
  );
}
