'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

export type HelpData = {
  sections?: Array<{
    id: string;
    icon: string;
    title: string;
    intro: string;
    steps: Array<{ title: string; desc: string; link?: string; linkLabel?: string }>;
    tip?: string;
  }>;
  issues?: Array<{
    severity: 'high' | 'medium' | 'low';
    symptom: string;
    cause: string;
    steps: string[];
    followUp?: { href: string; label: string };
  }>;
  sections_faq?: Array<{
    heading: string;
    items: Array<{ q: string; a: string; link?: { href: string; label: string } }>;
  }>;
};

type HelpPageProps = {
  locale: string;
  data: HelpData;
  pageTitle: string;
  pageSubtitle: string;
  type: 'sops' | 'troubleshooting' | 'faq';
};

const ICON_MAP: Record<string, React.ReactNode> = {
  Store: null,
  Settings: null,
  Play: null,
  BarChart2: null,
  Sparkles: null,
  Target: null,
};

export default function HelpPage({ locale, data, pageTitle, pageSubtitle, type }: HelpPageProps) {
  const t = useTranslations('common');
  const isVi = locale.startsWith('vi');

  const renderSops = () => (
    <div className="space-y-8">
      {/* Table of Contents */}
      <div className="rounded-xl border border-border bg-card/50 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isVi ? 'Mục Lục' : 'Table of Contents'}
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          {data.sections?.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-muted/30"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      {data.sections?.map((section) => (
        <section key={section.id} id={section.id} className="space-y-4 scroll-mt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary-400">
              {section.icon && <span className="text-lg">●</span>}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{section.intro}</p>

          <div className="space-y-3">
            {section.steps.map((step, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-card/50 p-4 hover:border-border/80 transition-colors"
              >
                <div className="shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="font-medium text-foreground text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                  {step.link && (
                    <Link
                      href={step.link}
                      className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                    >
                      {step.linkLabel} <ArrowRight className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {section.tip && (
            <div className="flex gap-3 rounded-lg bg-accent-500/5 border border-accent-500/20 p-3">
              <AlertCircle className="w-4 h-4 text-accent-400 shrink-0 mt-0.5" />
              <p className="text-xs text-accent-300/80 leading-relaxed">
                <span className="font-semibold">Tip:</span> {section.tip}
              </p>
            </div>
          )}
        </section>
      ))}
    </div>
  );

  const renderTroubleshooting = () => {
    const severityStyles = {
      high: { bg: 'bg-red-950/20', border: 'border-red-900/40' },
      medium: { bg: 'bg-amber-950/20', border: 'border-amber-900/40' },
      low: { bg: 'bg-muted-900/40', border: 'border-border-800' },
    };

    const severityLabels = isVi
      ? { high: 'Cao', medium: 'Trung bình', low: 'Thấp' }
      : { high: 'High', medium: 'Medium', low: 'Low' };

    return (
      <div className="space-y-4">
        {data.issues?.map((issue, i) => {
          const style = severityStyles[issue.severity];
          return (
            <div key={i} className={`rounded-xl border ${style.border} ${style.bg} p-5 space-y-3`}>
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground-100">{issue.symptom}</h2>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted-800 border border-border-700 text-muted-foreground-300">
                      {severityLabels[issue.severity]}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground-400 leading-relaxed">
                    <span className="text-muted-foreground-500">{isVi ? 'Nguyên nhân: ' : 'Cause: '}</span>
                    {issue.cause}
                  </p>
                </div>
              </div>

              <ol className="pl-11 space-y-1.5">
                {issue.steps.map((step, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground-300">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {issue.followUp && (
                <div className="pl-11">
                  <a
                    href={issue.followUp.href}
                    className="inline-block mt-1 text-xs px-3 py-1.5 bg-muted-800 hover:bg-muted-700 text-primary-300 rounded-lg transition-colors"
                  >
                    {issue.followUp.label} →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderFaq = () => (
    <div className="space-y-8">
      {data.sections_faq?.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-primary-300">
            {section.heading}
          </h2>
          <div className="space-y-3">
            {section.items.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-border-800 bg-muted-900/50 hover:border-border-700 transition-colors"
              >
                <summary className="flex items-start gap-3 p-4 cursor-pointer list-none">
                  <HelpCircle className="w-4 h-4 text-primary-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-sm font-medium text-muted-foreground-200 group-open:text-white">
                    {item.q}
                  </span>
                </summary>
                <div className="px-4 pb-4 pl-11 space-y-2">
                  <p className="text-sm text-muted-foreground-400 leading-relaxed">{item.a}</p>
                  {item.link && (
                    <a
                      href={item.link.href}
                      className="inline-block mt-2 text-xs px-3 py-1.5 bg-muted-800 hover:bg-muted-700 text-primary-300 rounded-lg transition-colors"
                    >
                      {item.link.label} →
                    </a>
                  )}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-border-800 bg-muted-900/30 p-4 text-center">
        <p className="text-sm text-muted-foreground-400">
          {isVi
            ? 'Không thấy câu trả lời? Vào Khắc phục sự cố hoặc email '
            : "Don't see your question? Visit Troubleshooting or email "}
          <Link href="/dashboard/help/troubleshooting" className="text-primary-400 hover:underline">
            {isVi ? 'Khắc phục sự cố' : 'Troubleshooting'}
          </Link>
          {isVi ? ' hoặc email ' : ' or email '}
          <a href="mailto:support@mekongmind.com" className="text-primary-400 hover:underline">
            support@mekongmind.com
          </a>
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 p-4 md:p-6 max-w-4xl">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href="/dashboard/help"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← {isVi ? 'Trung Tâm Trợ Giúp' : 'Help Center'}
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 ring-1 ring-primary/30">
            <HelpCircle className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{pageSubtitle}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {type === 'sops' && renderSops()}
      {type === 'troubleshooting' && renderTroubleshooting()}
      {type === 'faq' && renderFaq()}
    </div>
  );
}
