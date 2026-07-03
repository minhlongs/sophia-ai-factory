"use client";

import { Link } from "@/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/seed/components/ui/button";

const FEATURE_PREVIEWS = [
  {
    key: "script",
    icon: "edit_note",
    gradient: "from-indigo-500/10 to-purple-500/10",
  },
  {
    key: "publish",
    icon: "publish",
    gradient: "from-indigo-500/10 to-cyan-500/10",
  },
  {
    key: "revenue",
    icon: "trending_up",
    gradient: "from-indigo-500/10 to-emerald-500/10",
  },
];

export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0F0F11] pt-16" data-testid="hero">
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 left-1/5 w-[600px] h-[600px] rounded-full blur-[150px] bg-indigo-500/[0.06]" />
        <div className="absolute bottom-1/4 right-1/5 w-[500px] h-[500px] rounded-full blur-[120px] bg-indigo-500/[0.04]" />
      </div>

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" aria-hidden="true" />

      <div className="relative max-w-[1200px] mx-auto px-6 pt-20 pb-24 w-full">
        <div className="text-center max-w-4xl mx-auto">
          {/* Eyebrow tagline */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-indigo-500/20 bg-indigo-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-sm font-medium text-indigo-400">{t("eyebrow")}</span>
          </div>

          {/* Headline */}
          <h1 className="text-[56px] leading-[1.1] font-bold text-white mb-6 tracking-tight">
            {t("headline")}
          </h1>

          {/* Subheading */}
          <p className="text-xl leading-relaxed text-[#A1A1AA] max-w-3xl mx-auto mb-10">
            {t("subtitle")}
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/login?tab=signup">
              <Button variant="primary" size="xl" className="rounded-lg px-8 text-base shadow-lg shadow-indigo-500/25">
                {t("cta_start")}
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="xl"
              className="rounded-lg px-8 text-base text-[#A1A1AA] hover:text-white border border-zinc-800 hover:border-zinc-700"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">play_arrow</span>
                </span>
                {t("cta_demo")}
              </span>
            </Button>
          </div>

          {/* Trust bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 mb-20">
            <span className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {t("trust_creators")}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-700 hidden sm:block" aria-hidden="true" />
            <span className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {t("trust_videos")}
            </span>
            <span className="w-1 h-1 rounded-full bg-zinc-700 hidden sm:block" aria-hidden="true" />
            <span className="flex items-center gap-2 text-sm text-[#A1A1AA]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {t("trust_rating")}
            </span>
          </div>

          {/* Feature preview cards */}
          <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {FEATURE_PREVIEWS.map((card) => (
              <div
                key={card.key}
                className="group relative rounded-lg border border-zinc-800 bg-[#18181B] p-6 text-left hover:border-indigo-500/30 transition-all duration-300"
              >
                <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 transition-colors">
                    <span className="material-symbols-outlined text-lg text-indigo-400">{card.icon}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">
                    {t(`card_${card.key}_title`)}
                  </h3>
                  <p className="text-sm text-[#A1A1AA] leading-relaxed">
                    {t(`card_${card.key}_desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
