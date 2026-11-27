'use client';

/**
 * Progressive Disclosure Inspector Drawer (Sophia UI/UX 2026 Core Kit).
 *
 * Clean-room side inspector inspired by `openstatusHQ/data-table-filters` (MIT)
 * and `assistant-ui/assistant-ui` composable primitives: keeps the primary
 * canvas uncluttered for non-tech CEOs while exposing full R&D telemetry on click.
 */

import Link from 'next/link';
import type { CapabilityFieldSpec, StudioCapabilitySpec } from '@/seed/ui/studio-capability-registry';

export interface StudioInspectorDrawerProps {
  readonly locale: 'vi' | 'en';
  readonly capability: StudioCapabilitySpec | null;
  readonly onClose: () => void;
}

const TONE_BADGE: Record<NonNullable<CapabilityFieldSpec['tone']>, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
};

export function StudioInspectorDrawer({
  locale,
  capability,
  onClose,
}: StudioInspectorDrawerProps) {
  if (!capability) {
    return null;
  }

  return (
    <aside
      aria-label={capability.title[locale]}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            {locale === 'vi' ? `Đợt ${capability.round} • ${capability.category}` : `Round ${capability.round} • ${capability.category}`}
          </p>
          <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
            {capability.title[locale]}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {locale === 'vi' ? 'Đóng' : 'Close'}
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {capability.summary[locale]}
      </p>

      <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
        {capability.inspectorFields.map((field) => {
          const tone = field.tone ?? 'neutral';
          return (
            <div key={field.key} className="flex items-center justify-between gap-2 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">{field.label[locale]}</dt>
              <dd className={`rounded-md px-2 py-0.5 text-xs font-medium ${TONE_BADGE[tone]}`}>
                {field.value}
              </dd>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-2 text-xs">
          <dt className="text-slate-400">{locale === 'vi' ? 'Lõi BE' : 'BE Module'}</dt>
          <dd className="font-mono text-slate-600 dark:text-slate-300">{capability.modulePath}</dd>
        </div>
      </dl>

      {capability.routeHref ? (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Link
            href={`/${locale}${capability.routeHref}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            {locale === 'vi' ? 'Mở không gian làm việc' : 'Open Workspace'}
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
