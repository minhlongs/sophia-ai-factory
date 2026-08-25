// i18n-namespace: creativeEconomy
/**
 * Memory List — latest learning entries from creative_memory.
 */

import type { MemoryInsight } from '@/land/creative-economy/types';

interface MemoryListProps {
  insights: MemoryInsight[];
  t: (key: string) => string;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function MemoryList({ insights, t }: MemoryListProps) {
  if (insights.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700">{t('memoryTitle')}</h3>
        <p className="mt-2 text-sm text-slate-500">{t('noMemory')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-700">{t('memoryTitle')}</h3>
      <ul className="mt-3 space-y-3">
        {insights.map((m) => (
          <li key={m.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {m.category}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  CONFIDENCE_STYLES[m.confidence] ?? CONFIDENCE_STYLES.low
                }`}
              >
                {t(`confidence_${m.confidence}`)}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(m.createdAtMs).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700">{m.title}</p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{m.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
