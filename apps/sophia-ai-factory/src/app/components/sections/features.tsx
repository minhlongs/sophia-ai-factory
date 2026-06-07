"use client";

import { useTranslations } from "next-intl";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";

const FEATURE_CARDS = [
  { key: "ai_engine", icon: "smart_toy", span: "md:col-span-2", gradient: "from-blue-500/20 to-cyan-500/10" },
  { key: "video_factory", icon: "videocam", span: "", gradient: "from-purple-500/20 to-violet-500/10" },
  { key: "credits", icon: "toll", span: "", gradient: "from-amber-500/20 to-orange-500/10" },
  { key: "api", icon: "api", span: "md:col-span-2", gradient: "from-green-500/20 to-emerald-500/10" },
];

export function Features() {
  const t = useTranslations("landing.features");

  return (
    <section id="features" className="py-28 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[150px] -z-10 bg-neon-purple/[0.06]" />

      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-20">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider rounded-full border text-neon-cyan bg-neon-cyan/5 border-neon-cyan/10">
            <span className="material-symbols-outlined text-sm">category</span>
            {t("badge_label")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </ScrollReveal>

        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {FEATURE_CARDS.map((card, i) => (
            <ScrollReveal key={card.key} delay={i * 100} className={card.span}>
              <div className="group gradient-border card-hover h-full cursor-pointer">
                <div className="relative h-full p-7 rounded-[16px] bg-card">
                  <div className={`absolute inset-0 rounded-[16px] bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className="relative">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 bg-neon-cyan/10">
                        <span className="material-symbols-outlined text-xl text-neon-cyan">
                          {card.icon}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground tracking-tight">
                          {t(`items.${card.key}.title`)}
                        </h3>
                        <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full text-neon-cyan bg-neon-cyan/[0.06]">
                          {t(`items.${card.key}.badge`)}
                        </span>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-sm">
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
