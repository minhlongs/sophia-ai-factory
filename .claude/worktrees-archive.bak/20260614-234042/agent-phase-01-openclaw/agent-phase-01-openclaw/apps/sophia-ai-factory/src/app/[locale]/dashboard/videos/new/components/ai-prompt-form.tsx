'use client';

/**
 * AiPromptForm — one-step video generation form.
 *
 * Replaces the 3-step HeyGen wizard. Submits to generateVideoAction server
 * action, then renders <RenderProgress> on success.
 *
 * Fields: prompt (textarea), style (select), language (select).
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { generateVideoAction } from '@/app/actions/video-generate-action';
import { RenderProgress } from './render-progress';

type Style = 'cinematic' | 'casual' | 'educational';
type Language = 'en' | 'vi';

interface FormState {
  prompt: string;
  style: Style;
  language: Language;
}

export function AiPromptForm() {
  const t = useTranslations('dashboard.videos');
  const [isPending, startTransition] = useTransition();
  const [missionId, setMissionId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    prompt: '',
    style: 'casual',
    language: 'en',
  });

  function handleChange(
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    startTransition(async () => {
      const result = await generateVideoAction(form);
      if (result.success) {
        setMissionId(result.missionId);
      } else {
        setServerError(result.error);
      }
    });
  }

  // Reset to form state for retry
  function handleRetry() {
    setMissionId(null);
    setServerError(null);
  }

  // ── Render Progress view after submission ────────────────────────────────
  if (missionId) {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {t('generate.missionCreated')} <code className="font-mono text-xs">{missionId}</code>
        </p>
        <RenderProgress missionId={missionId} onRetry={handleRetry} />
      </div>
    );
  }

  // ── Form view ────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Prompt */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium">
          {t('generate.promptLabel')}
        </label>
        <textarea
          id="prompt"
          name="prompt"
          value={form.prompt}
          onChange={handleChange}
          rows={4}
          minLength={10}
          maxLength={500}
          required
          placeholder={t('generate.promptPlaceholder')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-xs text-muted-foreground text-right">
          {form.prompt.length}/500
        </span>
      </div>

      {/* Style */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="style" className="text-sm font-medium">
          {t('generate.styleLabel')}
        </label>
        <select
          id="style"
          name="style"
          value={form.style}
          onChange={handleChange}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="casual">{t('generate.styleCasual')}</option>
          <option value="cinematic">{t('generate.styleCinematic')}</option>
          <option value="educational">{t('generate.styleEducational')}</option>
        </select>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="language" className="text-sm font-medium">
          {t('generate.languageLabel')}
        </label>
        <select
          id="language"
          name="language"
          value={form.language}
          onChange={handleChange}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="en">{t('generate.languageEn')}</option>
          <option value="vi">{t('generate.languageVi')}</option>
        </select>
      </div>

      {/* Server error */}
      {serverError && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {serverError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending || form.prompt.length < 10}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? t('generate.submitting') : t('generate.submit')}
      </button>
    </form>
  );
}
