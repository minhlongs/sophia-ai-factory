'use client';

/**
 * History region — the user's own image jobs, selectable.
 *
 * Failed jobs stay listed. A new failure must not silently replace the memory
 * of an earlier success, and the user still needs to reach a failed attempt
 * to understand what happened.
 */

import { useTranslations } from 'next-intl';
import type { ImageJobView } from '@/tree/creative-studio/image-job-view-model';

export function ImageHistoryStrip({
  jobs,
  selectedId,
  onSelect,
  loadFailed = false,
}: {
  jobs: ImageJobView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** True when the history read failed, so the empty state is not a lie. */
  loadFailed?: boolean;
}) {
  const t = useTranslations('imageStudio');

  if (jobs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface-container-lowest p-4 text-center text-xs text-muted-foreground">
        {loadFailed ? t('history.loadFailed') : t('history.empty')}
      </p>
    );
  }

  return (
    <ul className="flex gap-2 overflow-x-auto lg:max-h-[38rem] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
      {jobs.map((job) => {
        const isSelected = job.id === selectedId;
        return (
          <li key={job.id} className="shrink-0 lg:shrink">
            <button
              type="button"
              onClick={() => onSelect(job.id)}
              aria-current={isSelected ? 'true' : undefined}
              className={`flex w-28 gap-2 rounded-lg border p-2 text-left lg:w-full ${
                isSelected
                  ? 'border-primary bg-primary-container'
                  : 'border-border hover:bg-muted'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotClass(job.stage)}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-foreground">
                  {job.prompt || t('history.untitled')}
                </span>
                <span className="block text-[0.65rem] text-muted-foreground">
                  {t(`status.${job.stage}`)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Stage colour. Selection is also carried by border weight and aria-current, never colour alone. */
function dotClass(stage: ImageJobView['stage']): string {
  switch (stage) {
    case 'done':
      return 'bg-success';
    case 'failed':
      return 'bg-destructive';
    default:
      return 'bg-muted-foreground';
  }
}
