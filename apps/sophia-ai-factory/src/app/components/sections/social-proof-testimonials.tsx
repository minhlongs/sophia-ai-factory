"use client";

import { useTranslations } from "next-intl";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";

const TESTIMONIAL_KEYS = ["creator_1", "creator_2", "creator_3"] as const;
const INITIALS_MAP: Record<string, string> = {
  creator_1: "NT",
  creator_2: "TH",
  creator_3: "LĐ",
};

export function TestimonialsGrid() {
  const t = useTranslations("landing.social_proof");

  return (
    <>
      <ScrollReveal className="text-center mb-14">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider rounded-full border text-indigo-500 bg-indigo-500/10 border-indigo-500/20">
          <span className="material-symbols-outlined text-sm">format_quote</span>
          {t("badges.customer_reviews")}
        </span>
        <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
          {t("title")}
        </h2>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          {t("subtitle")}
        </p>
      </ScrollReveal>

      <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {TESTIMONIAL_KEYS.map((key, i) => (
          <ScrollReveal key={key} delay={i * 100}>
            <div className="gradient-border h-full cursor-pointer group">
              <div className="p-6 rounded-lg bg-zinc-900 h-full flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <span key={`star-${key}-${j}`} className="material-symbols-outlined text-base text-amber-400" aria-hidden="true">star</span>
                  ))}
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm flex-1">
                  &ldquo;{t(`testimonials.${key}.quote`)}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-3 border-t border-zinc-800/50">
                  <div className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300 bg-gradient-to-br from-indigo-500 to-indigo-700">
                    {INITIALS_MAP[key]}
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-sm">{t(`testimonials.${key}.name`)}</p>
                    <p className="text-muted-foreground text-xs">{t(`testimonials.${key}.role`)}</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
        {t("testimonials_disclaimer")}
      </p>
    </>
  );
}
