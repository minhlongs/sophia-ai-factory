// i18n-namespace: creativeEconomy
/**
 * Memory Correction Form — inline form for submitting user corrections to creative_memory entries.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/seed/components/ui/button';

export const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function CorrectionForm({
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

      onClose();
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
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? t('correcting') : t('correctMemory')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
