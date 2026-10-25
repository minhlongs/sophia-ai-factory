/**
 * Verified Comparison Matrix — Semantic HTML <table> for LLM & RAG parser extraction.
 * Marked with data-aeo-citation="comparison-matrix" for SpeakableSpecification.
 * Layer: forest/components/aeo
 */

import type { AeoComparisonRow, AeoLocale } from '@/seed/aeo';

export interface VerifiedComparisonMatrixProps {
  readonly rows: readonly AeoComparisonRow[];
  readonly locale: AeoLocale;
  readonly caption?: string;
}

export function VerifiedComparisonMatrix({
  rows,
  locale,
  caption,
}: VerifiedComparisonMatrixProps) {
  const isVi = locale === 'vi';
  if (rows.length === 0) return null;

  return (
    <div
      data-aeo-citation="comparison-matrix"
      className="spatial-bento-card p-5 sm:p-6 overflow-x-auto"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base sm:text-lg font-bold text-foreground">
          {caption ?? (isVi ? 'Bảng Đối Chiếu Hiệu Suất Đã Xác Thực' : 'Verified Architecture & ROI Comparison')}
        </h3>
        <span className="rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
          {isVi ? 'Dữ liệu cấu trúc chuẩn LLM' : 'Structured Table for LLMs'}
        </span>
      </div>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-3 pr-4 font-semibold">
              {isVi ? 'Tiêu chí đánh giá' : 'Evaluation Dimension'}
            </th>
            <th scope="col" className="py-3 px-4 font-semibold text-primary">
              Sophia AI Factory (2027)
            </th>
            <th scope="col" className="py-3 px-4 font-semibold">
              {isVi ? 'Cách làm truyền thống' : 'Legacy / Manual Workflow'}
            </th>
            <th scope="col" className="py-3 pl-4 font-semibold text-right text-accent">
              {isVi ? 'Lợi thế định lượng' : 'Verified Advantage'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row) => (
            <tr key={row.dimension} className="hover:bg-muted/40 transition-colors">
              <th scope="row" className="py-3 pr-4 font-semibold text-foreground">
                {row.dimension}
              </th>
              <td className="py-3 px-4 font-medium text-foreground">
                {row.sophiaValue}
              </td>
              <td className="py-3 px-4 text-muted-foreground">
                {row.legacyValue}
              </td>
              <td className="py-3 pl-4 text-right font-bold text-accent tabular-kpi">
                {row.advantageMetric}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
