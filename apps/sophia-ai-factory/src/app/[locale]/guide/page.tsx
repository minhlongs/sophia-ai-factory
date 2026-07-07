import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Bot, MessageCircle } from "lucide-react";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCallout } from "@/forest/components/guide/guide-callout";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.guide.gettingStarted" });
  return {
    title: t("hero_title"),
    description: t("hero_subtitle"),
  };
}

export default async function GuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.guide.gettingStarted" });

  const mono = (chunks: React.ReactNode) => (
    <span className="font-mono text-accent-400 text-xs bg-accent-500/10 px-1.5 py-0.5 rounded">{chunks}</span>
  );
  const strong = (chunks: React.ReactNode) => (
    <strong className="text-foreground">{chunks}</strong>
  );

  const nextSteps = [
    { href: "/guide/telegram", label: t("next_step_telegram"), desc: t("next_step_telegram_desc") },
    { href: "/guide/how-it-works", label: t("next_step_how"), desc: t("next_step_how_desc") },
    { href: "/guide/faq", label: t("next_step_faq"), desc: t("next_step_faq_desc") },
  ];

  return (
    <div className="max-w-3xl space-y-10">
      {/* Hero */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
          {t("hero_title")}
        </h1>
        <p className="text-muted-foreground leading-relaxed">{t("hero_subtitle")}</p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground">{t("steps_title")}</h2>

        <GuideStepCard
          step={1}
          title={t("step1_title")}
          description={<span>{t.rich("step1_desc", { mono, strong })}</span>}
        />

        <GuideCallout variant="tip">
          {t.rich("callout_no_account", { strong })}
        </GuideCallout>

        <GuideStepCard
          step={2}
          title={t("step2_title")}
          description={<span>{t.rich("step2_desc", { mono, strong })}</span>}
        />

        <GuideCallout variant="info">
          {t.rich("callout_keys_info", { strong })}
        </GuideCallout>

        <GuideStepCard
          step={3}
          title={t("step3_title")}
          description={<span>{t.rich("step3_desc", { strong })}</span>}
        />

        <GuideStepCard
          step={4}
          title={t("step4_title")}
          description={<span>{t.rich("step4_desc", { strong })}</span>}
        />

        <GuideStepCard
          step={5}
          title={t("step5_title")}
          description={
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-accent-400" aria-hidden="true" />
                <span>
                  {t("step5_telegram")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-primary-400" aria-hidden="true" />
                <span>
                  {t("step5_email")}
                </span>
              </div>
            </div>
          }
        />
      </div>

      {/* Next steps */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">{t("next_steps_title")}</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {nextSteps.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group bg-card/50 border border-border/40 rounded-xl p-4 hover:border-primary-500/40 hover:bg-primary-500/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2 focus:ring-offset-background"
            >
              <div className="text-sm font-medium text-foreground group-hover:text-primary-300 transition-colors flex items-center gap-1.5">
                {item.label}
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
