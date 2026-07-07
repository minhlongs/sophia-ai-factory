'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import type { CeoCampaign } from './actions';
import { createCampaignAction } from './actions';

interface CampaignsClientProps {
  locale: string;
  userId: string;
  campaigns: CeoCampaign[];
  tier: string;
  remainingThisMonth: number;
  titleLabel: string;
  subtitleLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  createCta: string;
  limitReachedLabel: string;
  createNewLabel: string;
  cancelLabel: string;
  generatingLabel: string;
  failedLabel: string;
  draftLabel: string;
  retryLabel: string;
  deleteLabel: string;
  deleteConfirmLabel: string;
}

function StatusBadge({ status }: { status: CeoCampaign['status'] }) {
  const styles: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-100', text: 'text-gray-600' },
    generating: { bg: 'bg-primary/10', text: 'text-primary' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    failed: { bg: 'bg-red-50', text: 'text-red-600' },
  };
  const { bg, text } = styles[status] ?? styles.draft;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bg} ${text}`}>
      {status}
    </span>
  );
}

export function CampaignsClient({
  locale,
  campaigns,
  tier,
  remainingThisMonth,
  titleLabel,
  subtitleLabel,
  emptyTitle,
  emptyDescription,
  createCta,
  limitReachedLabel,
  createNewLabel,
  cancelLabel,
  generatingLabel,
  failedLabel,
  draftLabel,
  retryLabel,
  deleteLabel,
  deleteConfirmLabel,
}: CampaignsClientProps) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [niche, setNiche] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState<'vi' | 'en'>(locale === 'vi' ? 'vi' : 'en');

  const canCreate = tier !== 'BASIC' && remainingThisMonth !== 0;

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createCampaignAction({ ok: true }, formData);
      if (!result.ok) {
        setError(result.error ?? 'unknown_error');
        return;
      }
      setTitle('');
      setNiche('');
      setTopic('');
      setShowForm(false);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{titleLabel}</h1>
        <p className="mt-1 text-sm text-gray-500">{subtitleLabel}</p>
      </div>

      {tier !== 'BASIC' && (
        <div className="flex items-center justify-between">
          {!canCreate && (
            <p className="text-sm text-amber-600">{limitReachedLabel}</p>
          )}
          {!showForm && canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80"
            >
              <Plus className="h-4 w-4" aria-hidden />
              {createNewLabel}
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form action={onSubmit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Campaign title" />
          <input name="niche" value={niche} onChange={(e) => setNiche(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Niche" />
          <input name="topic" value={topic} onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Topic" />
          <select name="language" value={language} onChange={(e) => setLanguage(e.target.value as 'vi' | 'en')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="vi">Vietnamese</option>
            <option value="en">English</option>
          </select>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} disabled={isPending}
              className="px-4 py-2 text-sm text-gray-600">{cancelLabel}</button>
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {createCta}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <h3 className="text-lg font-medium text-gray-700">{emptyTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">{emptyDescription}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <article key={campaign.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="truncate text-sm font-semibold text-gray-900">{campaign.title}</h3>
                    <StatusBadge status={campaign.status} />
                  </div>
                  {campaign.niche && (
                    <p className="mt-1 text-xs text-gray-500">Niche: {campaign.niche}</p>
                  )}
                  {campaign.status === 'completed' && campaign.generated_script && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-primary hover:underline">View script</summary>
                      <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                        {campaign.generated_script}
                      </pre>
                    </details>
                  )}
                  {campaign.status === 'failed' && campaign.error_message && (
                    <p className="mt-2 text-xs text-red-600">{campaign.error_message}</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
