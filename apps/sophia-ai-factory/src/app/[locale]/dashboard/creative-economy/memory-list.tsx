// i18n-namespace: creativeEconomy
/**
 * Memory List — latest learning entries from creative_memory with correction capability.
 */

'use client';

import { useState } from 'react';
import type { MemoryInsight } from '@/land/creative-economy/types';

interface MemoryListProps {
  insights: MemoryInsight[];
  t: (key: string) => string;
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

function CorrectionForm({
  memoryId,
  t,
  onClose,
}: {
  memoryId: string;
  t: (key: string) => string;
  onClose: () => void;
}) {
  const [correctedContent, setCorrectedContent] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctedContent.trim() || !correctionReason.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Try to parse as JSON, fall back to string
      let parsedContent: unknown;
      try {
        parsedContent = JSON.parse(correctedContent);
      } catch {
        parsedContent = correctedContent;
      }

      const res = await fetch(`/api/creative-memory/${memoryId}/correct`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correctedContent: parsedContent,
          correctionReason,
        }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error || t('correctError'));
        return;
      }

      // Close form on success
      onClose();
      // Optionally show toast or trigger refresh
      alert(t('correctSuccess'));
    } catch {
      setError(t('correctError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <h4 className="text-sm font-medium text-slate-700">{t('correctMemoryTitle')}</h4>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {t('correctedContent')}
        </label>
        <textarea
          value={correctedContent}
          onChange={(e) => setCorrectedContent(e.target.value)}
          placeholder={t('correctedContentPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          rows={3}
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {t('correctionReason')}
        </label>
        <textarea
          value={correctionReason}
          onChange={(e) => setCorrectionReason(e.target.value)}
          placeholder={t('correctionReasonPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          rows={2}
          required
        />
      </div>

      {error && (
        <p className="text-xs text-rose-600">{error}</p>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t('correcting') : t('correctMemory')}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

export function MemoryList({ insights, t }: MemoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (insights.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700">{t('memoryTitle')}</h3>
        <p className="mt-2 text-sm text-slate-500">{t('noMemory')}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{t('memoryTitle')}</h3>
      </div>
      <ul className="mt-3 space-y-3">
        {insights.map((m) => (
          <li key={m.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {m.category}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs ${
                  CONFIDENCE_STYLES[m.confidence] ?? CONFIDENCE_STYLES.low
                }`}
              >
                {t(`confidence_${m.confidence}`)}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(m.createdAtMs).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium text-slate-700">{m.title}</p>
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{m.summary}</p>

            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setEditingId(m.id)}
                disabled={editingId !== null && editingId !== m.id}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
              >
                {editingId === m.id ? t('correcting') : t('correctMemory')}
              </button>
            </div>

            {editingId === m.id && (
              <CorrectionForm memoryId={m.id} t={t} onClose={() => setEditingId(null)} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
