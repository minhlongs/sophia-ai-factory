"use client";

import { useTranslations } from "next-intl";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";

const FEATURE_CARDS = [
  { key: "ai_engine", icon: "smart_toy", span: "md:col-span-2" },
  { key: "video_factory", icon: "videocam", span: "" },
  { key: "credits", icon: "toll", span: "" },
  { key: "api", icon: "api", span: "md:col-span-2" },
];

export function Features() {
  const t = useTranslations("landing.features");

  return (
    <section id="features" className="py-28 relative overflow-hidden bg-[#0F0F11]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[150px] -z-10 bg-indigo-500/[0.04]" />

      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider rounded-full border border-indigo-500/20 text-indigo-400 bg-indigo-500/5">
            <span className="material-symbols-outlined text-sm">category</span>
            {t("badge_label")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 tracking-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-[#A1A1AA] max-w-xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {FEATURE_CARDS.map((card, i) => (
            <ScrollReveal key={card.key} delay={i * 100} className={card.span}>
              <div className="group h-full">
                <div className="relative h-full p-7 rounded-lg border border-zinc-800 bg-[#18181B] hover:border-indigo-500/30 transition-all duration-300">
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:bg-indigo-500/20">
                        <span className="material-symbols-outlined text-xl text-indigo-400">
                          {card.icon}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {t(`items.${card.key}.title`)}
                        </h3>
                        <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full text-indigo-400 bg-indigo-500/[0.08]">
                          {t(`items.${card.key}.badge`)}
                        </span>
                      </div>
                    </div>
                    <p className="text-[#A1A1AA] leading-relaxed text-sm">
                      {t(`items.${card.key}.description`)}
                    </p>
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
