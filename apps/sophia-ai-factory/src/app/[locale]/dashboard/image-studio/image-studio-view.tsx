'use client';

/**
 * Image Studio workspace view.
 *
 * Regions, left to right on wide screens and stacked on narrow ones:
 *  A. History strip — this user's own image jobs, selectable.
 *  B. Main preview — the selected artifact, its state, or the empty/failure
 *     state. Nothing is invented: an unknown status is never rendered as a
 *     finished image.
 *  C. Brief inspector — the next generation's prompt and settings, kept
 *     visually and structurally distinct from the selected artifact's
 *     metadata.
 */

import { useTranslations } from 'next-intl';
import { ImagePreviewPanel } from './image-preview-panel';
import { ImageStudioBriefPanel } from './image-brief-panel';
import { ImageHistoryStrip } from './image-history-strip';
import { useImageStudioState, type StudioModel } from './use-image-studio-state';
import { selectableImageModelsForTier } from '@/seed/config/tiers/image-model-access';
import type { ImageJobView } from '@/tree/creative-studio/image-job-view-model';

export function ImageStudioView({
  initialJobs,
  historyLoadFailed,
  tier,
}: {
  initialJobs: ImageJobView[];
  /** True when the history read failed, so the empty state is not a lie. */
  historyLoadFailed: boolean;
  tier: string;
}) {
  const t = useTranslations('imageStudio');
  const models: StudioModel[] = buildModelOptions(tier);

  const state = useImageStudioState(initialJobs, models);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
      <section aria-labelledby="image-studio-preview-heading" className="min-w-0 flex-1">
        <h1 id="image-studio-preview-heading" className="sr-only">
          {t('title')}
        </h1>
        <ImagePreviewPanel
          job={state.selectedJob}
          selectedStatus={state.selectedStatus}
          statusError={state.statusError}
          onRetryStatus={state.retryStatus}
        />
      </section>

      <aside aria-labelledby="image-studio-history-heading" className="lg:w-56 lg:shrink-0">
        <h2 id="image-studio-history-heading" className="sr-only">
          {t('history.title')}
        </h2>
        <ImageHistoryStrip
          jobs={state.jobs}
          selectedId={state.selectedJob?.id ?? null}
          onSelect={state.selectJob}
          loadFailed={historyLoadFailed}
        />
      </aside>

      <aside aria-labelledby="image-studio-brief-heading" className="lg:w-80 lg:shrink-0">
        <h2 id="image-studio-brief-heading" className="sr-only">
          {t('brief.title')}
        </h2>
        <ImageStudioBriefPanel
          state={state}
          models={models}
          tier={tier}
        />
      </aside>
    </div>
  );
}

/** Model options for the current tier, gate state included. */
function buildModelOptions(tier: string): StudioModel[] {
  // Only cost-owned models are ever offered or advertised as upgrade targets.
  // The MuAPI ids stay in the access map but reach no picker, so a customer is
  // never invited to start work that nobody pays for.
  const allowed = selectableImageModelsForTier(tier);
  const blocked = selectableImageModelsForTier('MASTER').filter((id) => !allowed.includes(id));
  return [
    ...allowed.map((id) => ({ id, allowed: true })),
    ...blocked.map((id) => ({ id, allowed: false })),
  ];
}
