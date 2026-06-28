"use client";

import { Link } from "@/navigation";
import { useTranslations } from "next-intl";
import { ScrollReveal } from "@/seed/components/ui/scroll-reveal";
import { Button } from "@/seed/components/ui/button";

const TAB_KEYS = ["video", "image", "audio", "brand", "templates"] as const;
const TAB_ICONS: Record<string, string> = {
  video: "videocam",
  image: "image",
  audio: "graphic_eq",
  brand: "palette",
  templates: "dashboard_customize",
};
const TAB_GRADIENTS: Record<string, string> = {
  video: "from-purple-500/20 to-violet-500/10",
  image: "from-pink-500/20 to-rose-500/10",
  audio: "from-cyan-500/20 to-blue-500/10",
  brand: "from-amber-500/20 to-orange-500/10",
  templates: "from-green-500/20 to-emerald-500/10",
};

export function CreativeStudioShowcase() {
  const t = useTranslations("landing.creative_studio");

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute top-1/2 right-1/4 w-[600px] h-[600px] rounded-full blur-[150px] -z-10 bg-neon-pink/[0.05]" />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full blur-[120px] -z-10 bg-neon-purple/[0.06]" />

      <div className="container mx-auto px-4">
        <ScrollReveal className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 mb-5 text-xs font-semibold uppercase tracking-wider rounded-full border text-neon-pink bg-neon-pink/5 border-neon-pink/10">
            <span className="material-symbols-outlined text-sm">palette</span>
            {t("badge")}
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto mb-12">
          {TAB_KEYS.map((key, i) => {
            const features = t.raw(`tabs.${key}.features`) as string[];
            return (
              <ScrollReveal key={key} delay={i * 80}>
                <div className="group gradient-border h-full cursor-pointer">
                  <div className="relative h-full p-5 rounded-[16px] bg-card">
                    <div className={`absolute inset-0 rounded-[16px] bg-gradient-to-br ${TAB_GRADIENTS[key]} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-neon-pink/10 group-hover:scale-110 transition-transform duration-300">
                        <span className="material-symbols-outlined text-lg text-neon-pink">{TAB_ICONS[key]}</span>
                      </div>
                      <h3 className="text-sm font-bold text-foreground mb-1 tracking-tight">
                        {t(`tabs.${key}.title`)}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                        {t(`tabs.${key}.description`)}
                      </p>
                      <ul className="space-y-1">
                        {features.map((feat: string) => (
                          <li key={feat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-1 h-1 rounded-full bg-neon-pink/50 flex-shrink-0" />
                            {feat}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal className="text-center">
          <Link href="/dashboard/creative-studio">
            <Button variant="glow" size="lg" className="glow-primary rounded-full px-8">
              {t("cta")}
            </Button>
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
