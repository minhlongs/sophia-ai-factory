/**
 * DualReadPageSection — Server Component orchestrating Spatial Bento 2027,
 * Answer-First Citation Block, Verified Comparison Matrix, JSON-LD @graph,
 * and the interactive AgentInspectorHud for any public surface.
 * Layer: forest/components/aeo
 */

import type { DualReadPagePayload } from '@/seed/aeo';
import { serializePageToMarkdown } from '@/tree/aeo';
import { AnswerFirstCitationBlock } from './answer-first-citation-block';
import { VerifiedComparisonMatrix } from './verified-comparison-matrix';
import { JsonLdScript } from './json-ld-script';
import { AgentInspectorHud } from './agent-inspector-hud';
import { SpatialBentoGrid, SpatialBentoCard } from './spatial-bento-grid';

export interface DualReadPageSectionProps {
  readonly payload: DualReadPagePayload;
}

export async function DualReadPageSection({ payload }: DualReadPageSectionProps) {
  const markdownContent = serializePageToMarkdown(payload);
  const isVi = payload.locale === 'vi';

  return (
    <section
      aria-label={isVi ? 'Không gian dữ liệu Dual-Read cho Người & AI' : 'Dual-Read Spatial Bento Section'}
      className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-6"
    >
      <JsonLdScript payload={payload} />

      <AnswerFirstCitationBlock
        title={payload.title}
        summary={payload.answerFirstSummary}
        lastVerifiedIso={payload.lastVerifiedIso}
        locale={payload.locale}
        metrics={payload.metrics}
        canonicalUrl={payload.canonicalUrl}
      />

      <VerifiedComparisonMatrix
        rows={payload.comparisonRows}
        locale={payload.locale}
      />

      {payload.faqs.length > 0 && (
        <SpatialBentoGrid ariaLabel={isVi ? 'Câu hỏi thường gặp chuẩn AEO' : 'AEO Verified FAQs'}>
          {payload.faqs.map((faq) => (
            <SpatialBentoCard
              key={faq.question}
              colSpan={6}
              eyebrow={isVi ? 'Hỏi & Đáp Thực Tế (FAQ)' : 'Verified FAQ'}
              title={faq.question}
              badge="Schema.org/FAQPage"
            >
              <p className="text-sm text-muted-foreground leading-relaxed">
                {faq.answer}
              </p>
            </SpatialBentoCard>
          ))}
        </SpatialBentoGrid>
      )}

      <AgentInspectorHud
        markdownContent={markdownContent}
        canonicalUrl={payload.canonicalUrl}
        locale={payload.locale}
      />
    </section>
  );
}
