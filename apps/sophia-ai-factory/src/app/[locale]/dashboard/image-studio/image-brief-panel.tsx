'use client';

/**
 * Brief and settings for the next generation.
 *
 * Deliberately separate from the preview metadata: the preview describes an
 * artifact that exists, this describes work that has not happened yet.
 */

import { useTranslations } from 'next-intl';
import type { ImageStudioState, StudioModel } from './use-image-studio-state';

const ASPECT_RATIOS: Array<'1:1' | '16:9' | '9:16' | '4:3'> = ['1:1', '16:9', '9:16', '4:3'];

export function ImageStudioBriefPanel({
  state,
  models,
  tier,
}: {
  state: ImageStudioState;
  models: StudioModel[];
  tier: string;
}) {
  const t = useTranslations('imageStudio');
  const allowedModels = models.filter((m) => m.allowed);
  const blockedModels = models.filter((m) => !m.allowed);
  const isDisabled =
    state.submission.kind === 'submitting' ||
    state.isPromptTooShort ||
    allowedModels.length === 0;

  return (
    <form
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        state.submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="image-studio-prompt" className="text-sm font-medium">
          {t('brief.promptLabel')}
        </label>
        <textarea
          id="image-studio-prompt"
          value={state.prompt}
          onChange={(e) => state.setPrompt(e.target.value)}
          placeholder={t('brief.promptPlaceholder')}
          rows={5}
          maxLength={2000}
          className="w-full rounded-lg border border-input bg-background p-2.5 text-sm"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{state.isPromptTooShort ? t('brief.promptRequired') : ''}</span>
          <span>{t('brief.charsRemaining', { count: state.remainingChars })}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="image-studio-model" className="text-sm font-medium">
          {t('brief.modelLabel')}
        </label>
        <select
          id="image-studio-model"
          value={state.model}
          onChange={(e) => state.setModel(e.target.value)}
          className="w-full rounded-lg border border-input bg-background p-2 text-sm"
        >
          {allowedModels.length === 0 && (
            <option value="">{t('brief.noModelsAvailable')}</option>
          )}
          {allowedModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
          {blockedModels.length > 0 && (
            <optgroup label={t('brief.lockedModels')}>
              {blockedModels.map((m) => (
                <option key={m.id} value="" disabled>
                  {m.id} — {t('brief.upgradeToUnlock')}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="text-xs text-muted-foreground">{t('brief.currentTier', { tier })}</p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium">{t('brief.aspectRatioLabel')}</legend>
        <div className="flex gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <button
              key={ratio}
              type="button"
              aria-pressed={state.aspectRatio === ratio}
              onClick={() => state.setAspectRatio(ratio)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium ${
                state.aspectRatio === ratio
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {ratio}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={isDisabled}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {state.submission.kind === 'submitting'
            ? t('brief.submitting')
            : t('brief.submit')}
        </button>

        {state.submission.kind === 'submitting' && (
          <p role="status" className="text-xs text-muted-foreground">
            {t('brief.submitAccepted')}
          </p>
        )}

        {state.submission.kind === 'accepted' && (
          <p role="status" className="text-xs text-success">
            {t('brief.accepted')}
          </p>
        )}

        {state.submission.kind === 'failed' && (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-xs text-destructive">
              {state.submission.code === 'NO_API_KEY'
                ? t('brief.missingKey')
                : t('brief.submitFailed')}
            </p>
            <button
              type="button"
              onClick={state.resetSubmission}
              className="self-start rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
            >
              {t('brief.dismiss')}
            </button>
          </div>
        )}

        {isDisabled && state.submission.kind !== 'submitting' && (
          <p className="text-xs text-muted-foreground">
            {state.isPromptTooShort
              ? t('brief.promptRequired')
              : t('brief.noModelsAvailableHint')}
          </p>
        )}
      </div>
    </form>
  );
}
