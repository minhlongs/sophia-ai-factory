'use client';

/**
 * Progressive Disclosure Inspector Drawer (Sophia UI/UX 2026 Core Kit).
 *
 * Clean-room side inspector inspired by `openstatusHQ/data-table-filters` (MIT)
 * and `assistant-ui/assistant-ui` composable primitives: keeps the primary
 * canvas uncluttered for non-tech CEOs while exposing full R&D telemetry on click.
 */

import { useEffect } from 'react';
import { Link } from '@/navigation';
import type { CapabilityFieldSpec, StudioCapabilitySpec } from '@/seed/ui/studio-capability-registry';

export interface StudioInspectorDrawerProps {
  readonly locale: 'vi' | 'en';
  readonly capability: StudioCapabilitySpec | null;
  readonly onClose: () => void;
}

const TONE_BADGE: Record<NonNullable<CapabilityFieldSpec['tone']>, string> = {
  neutral: 'bg-muted text-foreground',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
};

export function StudioInspectorDrawer({
  locale,
  capability,
  onClose,
}: StudioInspectorDrawerProps) {
  useEffect(() => {
    if (!capability) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [capability, onClose]);

  if (!capability) {
    return null;
  }

  return (
    <aside
      aria-label={capability.title[locale]}
      className="md3-surface-tonal p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-text">
            {capability.kpiLabel[locale]}
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground">
            {capability.title[locale]}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="md3-pill-button min-h-[44px] min-w-[44px] border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {locale === 'vi' ? 'Đóng' : 'Close'}
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {capability.summary[locale]}
      </p>

      <dl className="mt-4 space-y-2.5 border-t border-border pt-4">
        {capability.inspectorFields.map((field) => {
          const tone = field.tone ?? 'neutral';
          return (
            <div key={field.key} className="flex items-center justify-between gap-2 text-sm">
              <dt className="text-muted-foreground">{field.label[locale]}</dt>
              <dd className={`rounded-md px-2 py-0.5 text-xs font-medium ${TONE_BADGE[tone]}`}>
                {field.value}
              </dd>
            </div>
          );
        })}
      </dl>

      {capability.routeHref ? (
        <div className="mt-4 border-t border-border pt-4">
          <Link
            href={capability.routeHref}
            className="md3-pill-button inline-flex min-h-[44px] w-full items-center justify-center bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {locale === 'vi' ? 'Mở không gian làm việc' : 'Open Workspace'}
          </Link>
        </div>
      ) : null}
    </aside>
  );
}
