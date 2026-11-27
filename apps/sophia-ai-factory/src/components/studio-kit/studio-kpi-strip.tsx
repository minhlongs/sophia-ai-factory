'use client';

/**
 * Executive KPI Telemetry Strip (Sophia UI/UX 2026 Core Kit).
 *
 * Clean-room tokenized strip inspired by `tremorlabs/tremor` (Apache-2.0) and
 * `shadcn-ui/ui` CSS Variables mode (MIT). Zero external chart runtime overhead.
 */

import type { StudioCapabilitySpec } from '@/seed/ui/studio-capability-registry';

export interface StudioKpiStripProps {
  readonly locale: 'vi' | 'en';
  readonly capabilities: readonly StudioCapabilitySpec[];
  readonly selectedId: string | null;
  readonly onSelect: (capability: StudioCapabilitySpec) => void;
}

const STATUS_DOT: Record<StudioCapabilitySpec['status'], string> = {
  live: 'bg-emerald-500',
  beta: 'bg-amber-500',
  guarded: 'bg-sky-500',
};

export function StudioKpiStrip({
  locale,
  capabilities,
  selectedId,
  onSelect,
}: StudioKpiStripProps) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="list"
      aria-label={locale === 'vi' ? 'Chỉ số động cơ Sophia' : 'Sophia engine telemetry'}
    >
      {capabilities.map((cap) => {
        const isSelected = selectedId === cap.id;
        return (
          <button
            key={cap.id}
            type="button"
            onClick={() => onSelect(cap)}
            className={`group flex flex-col items-start rounded-xl border p-4 text-left transition-all ${
              isSelected
                ? 'border-indigo-500 bg-indigo-50/60 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/30'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {cap.kpiLabel[locale]}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[cap.status]}`} />
                {cap.status}
              </span>
            </div>
            <div className="mt-1.5 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {cap.kpiValue}
            </div>
            <div className="mt-1 line-clamp-1 text-sm font-medium text-slate-700 group-hover:text-indigo-600 dark:text-slate-200 dark:group-hover:text-indigo-400">
              {cap.title[locale]}
            </div>
          </button>
        );
      })}
    </div>
  );
}
