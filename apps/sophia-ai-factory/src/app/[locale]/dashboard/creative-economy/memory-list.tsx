// i18n-namespace: creativeEconomy
/**
 * Memory List — latest learning entries from creative_memory with correction capability.
 */

'use client';

import { useState } from 'react';
import { EmptyState } from '@/seed/components/ui/empty-state';
import { Brain } from 'lucide-react';
import type { MemoryInsight } from '@/land/creative-economy/types';
import { CONFIDENCE_STYLES, CorrectionForm } from './memory-correction-form';

interface MemoryListProps {
  insights: MemoryInsight[];
  t: (key: string) => string;
}

export function MemoryList({ insights, t }: MemoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (insights.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700">{t('memoryTitle')}</h3>
        <EmptyState
          icon={Brain}
          title={t('noMemoryTitle')}
          description={t('noMemoryDesc')}
        />
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
