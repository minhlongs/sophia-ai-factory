'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { submitCreatorApplication } from './actions';

export function ApplyForm() {
  const t = useTranslations('sop.creator.apply');
  const [state, formAction, pending] = useActionState(submitCreatorApplication, { success: false });

  if (state.success) {
    return (
      <div className="rounded-2xl bg-green-500/10 border border-green-500/30 p-8 text-center space-y-3">
        <div className="text-4xl" aria-hidden="true">🎉</div>
        <h2 className="text-xl font-semibold text-white">{t('successTitle')}</h2>
        <p className="text-white/70">{t('successDesc')}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-white/80">
          {t('emailLabel')}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={state.email ?? ''}
          placeholder={t('emailPlaceholder')}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="reason" className="block text-sm font-medium text-white/80">
          {t('reasonLabel')}
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          rows={5}
          defaultValue={state.reason ?? ''}
          placeholder={t('reasonPlaceholder')}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-y min-h-[120px]"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 transition-colors"
      >
        {pending ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
