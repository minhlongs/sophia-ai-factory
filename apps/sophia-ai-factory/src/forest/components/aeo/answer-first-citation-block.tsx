/**
 * Answer-First Citation Block — GEO/AEO high-density summary & verified KPI strip.
 * Marked with data-aeo-citation="answer-first" to match SpeakableSpecification in JSON-LD.
 * Layer: forest/components/aeo
 */

import type { AeoCitationMetric, AeoLocale } from '@/seed/aeo';

export interface AnswerFirstCitationBlockProps {
  readonly title: string;
  readonly summary: string;
  readonly lastVerifiedIso: string;
  readonly locale: AeoLocale;
  readonly metrics: readonly AeoCitationMetric[];
  readonly canonicalUrl: string;
}

export function AnswerFirstCitationBlock({
  title,
  summary,
  lastVerifiedIso,
  locale,
  metrics,
  canonicalUrl,
}: AnswerFirstCitationBlockProps) {
  const isVi = locale === 'vi';
  return (
    <aside
      aria-label={isVi ? 'Tóm tắt chuẩn AI Answer Engine' : 'AI Answer Engine Verified Summary'}
      data-aeo-citation="answer-first"
      className="spatial-bento-card aeo-citation-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-accent animate-glow-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {isVi ? 'Chuẩn Trích Dẫn AI (AEO / GEO Ground Truth)' : 'AI Citation Ready (AEO / GEO Ground Truth)'}
          </span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {isVi ? 'Xác thực:' : 'Verified:'} <time dateTime={lastVerifiedIso}>{lastVerifiedIso}</time>
        </span>
      </div>

      <h2 className="text-base sm:text-lg font-bold text-foreground mb-2">
        {title}
      </h2>

      <p className="text-sm sm:text-base leading-relaxed text-foreground/90 mb-5">
        {summary}
      </p>

      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-border/70">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg bg-background/70 border border-border/60 p-3"
          >
            <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {metric.label}
            </dt>
            <dd className="mt-1 text-lg sm:text-xl font-extrabold text-foreground tabular-kpi">
              {metric.value}
            </dd>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {metric.sourceNote}
            </p>
          </div>
        ))}
      </dl>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground font-mono">
        <span>Canonical: {canonicalUrl}</span>
        <span>Protocol: Dual-Read HTML + Markdown + JSON-LD @graph</span>
      </div>
    </aside>
  );
}
