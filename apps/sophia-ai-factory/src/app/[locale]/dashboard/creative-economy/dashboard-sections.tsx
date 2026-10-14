// i18n-namespace: creativeEconomy
/**
 * Creative Economy Dashboard — Section wrapper components.
 */

import type {
  DashboardResult,
  DashboardSummary,
  AssetPerformanceRow,
  MemoryInsight,
  PlaybookHealthRow,
  VelocityPoint,
  InvestmentAdviceRow,
} from '@/land/creative-economy';
import { SummaryCards } from './summary-cards';
import { AssetTable } from './asset-table';
import { MemoryList } from './memory-list';
import { PlaybookCards } from './playbook-cards';
import { VelocityChart } from './velocity-chart';
import { InvestmentAdvice } from './investment-advice';

export type TFn = (key: string, values?: Record<string, string | number | Date>) => string;

export function SectionError({ message, t }: { message: string; t: (key: string) => string }) {
  return (
    <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {t('sectionError')}: {message}
    </div>
  );
}

export function SummarySection({
  result,
  t,
}: {
  result: DashboardResult<DashboardSummary>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return (
    <div className="mt-2">
      <SummaryCards summary={result.value} t={t} />
    </div>
  );
}

export function AssetSection({
  result,
  t,
}: {
  result: DashboardResult<AssetPerformanceRow[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <AssetTable rows={result.value} t={t} />;
}

export function VelocitySection({
  result,
  t,
}: {
  result: DashboardResult<VelocityPoint[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <VelocityChart points={result.value} t={t} />;
}

export function MemorySection({
  result,
  t,
}: {
  result: DashboardResult<MemoryInsight[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return (
    <div className="mt-6">
      <MemoryList insights={result.value} t={t} />
    </div>
  );
}

export function PlaybookSection({
  result,
  t,
}: {
  result: DashboardResult<PlaybookHealthRow[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return (
    <div className="mt-6">
      <PlaybookCards rows={result.value} t={t} />
    </div>
  );
}

export function InvestmentSection({
  result,
  t,
}: {
  result: DashboardResult<InvestmentAdviceRow[]>;
  t: TFn;
}) {
  if (!result.ok) return <SectionError message={result.error.message} t={t} />;
  return <InvestmentAdvice rows={result.value} t={t} />;
}
