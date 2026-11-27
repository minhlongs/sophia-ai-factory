'use client';

/**
 * Executive KPI Telemetry Strip (MD3 Expressive 100/100).
 * Displays all registered engines using MD3 tonal surface containers,
 * tabular-nums, and zero hardcoded light/slate backgrounds.
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
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      role="list"
      aria-label={locale === 'vi' ? 'Danh sách 34 động cơ Sophia' : 'Sophia 34 live engines'}
    >
      {capabilities.map((cap) => {
        const isSelected = selectedId === cap.id;
        return (
          <button
            key={cap.id}
            type="button"
            onClick={() => onSelect(cap)}
            className={`group flex flex-col items-start rounded-2xl border p-4 text-left transition-all ${
              isSelected
                ? 'border-primary bg-[var(--md-sys-color-primary-container)] shadow-sm'
                : 'border-border bg-[var(--md-sys-color-surface-container-low)] hover:border-primary/40 hover:bg-[var(--md-sys-color-surface-container)]'
            }`}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-muted-foreground">
                R{cap.round} • {cap.kpiLabel[locale]}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[cap.status]}`} />
                {cap.status}
              </span>
            </div>
            <div className="md3-tabular-nums mt-1.5 text-lg font-bold tracking-tight text-foreground">
              {cap.kpiValue}
            </div>
            <div className="mt-1 line-clamp-1 text-sm font-semibold text-foreground group-hover:text-primary">
              {cap.title[locale]}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {cap.summary[locale]}
            </p>
          </button>
        );
      })}
    </div>
  );
}
