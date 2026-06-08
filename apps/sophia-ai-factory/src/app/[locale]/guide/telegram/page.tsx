import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { GuideStepCard } from "@/forest/components/guide/guide-step-card";
import { GuideCodeBlock } from "@/forest/components/guide/guide-code-block";
import { GuideCallout } from "@/forest/components/guide/guide-callout";
import { buildBreadcrumbSchema } from "@/land/seo/schema-org";

const SITE_URL = 'https://sophia.agencyos.network';
const breadcrumbSchema = buildBreadcrumbSchema([
  { name: 'Home', url: SITE_URL },
  { name: 'Guide', url: `${SITE_URL}/guide` },
  { name: 'Telegram Bot', url: `${SITE_URL}/guide/telegram` },
]);

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.guide.telegram" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

const BOT_COMMANDS = `/start
/email
/campaign
/status
/results
/cancel
/tier
/quota
/help`;

export default async function TelegramGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.guide.telegram" });

  const commandTable = [
    { cmd: "/start", desc: t("table.start") },
    { cmd: "/campaign", desc: t("table.campaign") },
    { cmd: "/status", desc: t("table.status") },
    { cmd: "/results", desc: t("table.results") },
    { cmd: "/cancel", desc: t("table.cancel") },
    { cmd: "/tier", desc: t("table.tier") },
    { cmd: "/quota", desc: t("table.quota") },
    { cmd: "/help", desc: t("table.help") },
  ];

  const mono = (chunks: React.ReactNode) => (
    <span className="font-mono text-accent-400 text-xs">{chunks}</span>
  );
  const strong = (chunks: React.ReactNode) => (
    <strong className="text-foreground">{chunks}</strong>
  );

  return (
    <div className="max-w-3xl space-y-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent mb-3">
          {t("heroTitle")}
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {t.rich("heroIntro", { mono })}
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">{t("setupTitle")}</h2>
        <div className="space-y-4">
          <GuideStepCard step={1} title={t("step1.title")} description={t("step1.description")} />
          <GuideStepCard
            step={2}
            title={t("step2.title")}
            description={<span>{t.rich("step2.description", { mono, strong })}</span>}
            code="@Sophia_Bbot"
          />
          <GuideStepCard
            step={3}
            title={t("step3.title")}
            description={<span>{t.rich("step3.description", { mono })}</span>}
            code="/email you@email.com"
          />
          <GuideStepCard
            step={4}
            title={t("step4.title")}
            description={<span>{t.rich("step4.description", { mono })}</span>}
            code={t("step4.code")}
          />
        </div>
      </div>

      <GuideCallout variant="warning" title={t("calloutTitle")}>
        {t.rich("calloutBody", { mono, strong })}
      </GuideCallout>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">{t("commandsTitle")}</h2>
        <GuideCodeBlock code={BOT_COMMANDS} language="telegram" />
      </div>

      <div className="border border-border/40 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[auto_1fr] bg-muted/30 px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 gap-6">
          <span>{t("tableHeaderCmd")}</span>
          <span>{t("tableHeaderDesc")}</span>
        </div>
        {commandTable.map((row) => (
          <div key={row.cmd} className="grid grid-cols-[auto_1fr] px-5 py-3 text-sm border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors gap-6 items-center">
            <span className="font-mono text-accent-400 text-xs bg-accent-500/10 px-2 py-0.5 rounded border border-accent-500/20 whitespace-nowrap">{row.cmd}</span>
            <span className="text-muted-foreground">{row.desc}</span>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">{t("tipsTitle")}</h2>
        <div className="space-y-3">
          <GuideCallout variant="tip">{t.rich("tip1", { em: (c) => <em className="text-foreground">{c}</em> })}</GuideCallout>
          <GuideCallout variant="info">{t.rich("tip2", { strong })}</GuideCallout>
        </div>
      </div>

      <div className="bg-card/50 border border-border/40 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("supportTitle")}</h3>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div>{t.rich("supportLine1", { mono })}</div>
          <div>{t.rich("supportLine2", { mono })}</div>
          <div>
            {t("supportSeeAlso")} → <Link href="/guide/faq" className="text-accent-400 hover:underline">{t("supportFaqLink")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
