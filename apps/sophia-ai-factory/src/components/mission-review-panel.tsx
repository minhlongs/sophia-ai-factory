'use client';

/**
 * MissionReviewPanel — the human decision surface for missions parked in
 * 'review'. Approve → completed | Request another round → iterating.
 * These are the only two legal transitions out of 'review'; the tree layer
 * remains the sole transition authority and rejects anything else
 * server-side (surfaced here as an inline error + router resync).
 */

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Check, RotateCcw, ShieldCheck } from 'lucide-react';
import { updateMissionStatus } from '@/land/creative-mission/actions';

type ReviewDecision = 'completed' | 'iterating';

export function MissionReviewPanel({ missionId }: { missionId: string }) {
  const t = useTranslations('missionConsole');
  const router = useRouter();
  const [pendingDecision, setPendingDecision] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const decide = async (decision: ReviewDecision) => {
    setPendingDecision(decision);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await updateMissionStatus({ missionId, status: decision });
      if (result.ok) {
        setSuccessMessage(
          t(decision === 'completed' ? 'review.approveSuccess' : 'review.iterateSuccess')
        );
      } else {
        // Includes INVALID_TRANSITION (another admin already decided) and
        // FORBIDDEN — refresh resyncs the panel with server truth.
        setError(result.error.code);
      }
      router.refresh();
    } catch {
      setError('NETWORK');
      router.refresh();
    } finally {
      setPendingDecision(null);
    }
  };

  return (
    <section className="rounded-lg border border-primary/40 bg-primary/5 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">{t('review.title')}</h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t('review.humanNote')}</p>

      {successMessage && (
        <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t('review.actionFailed', { code: error })}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => decide('completed')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {pendingDecision === 'completed' ? t('review.deciding') : t('review.approve')}
        </button>
        <button
          type="button"
          disabled={pendingDecision !== null}
          onClick={() => decide('iterating')}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" />
          {pendingDecision === 'iterating' ? t('review.deciding') : t('review.iterating')}
        </button>
      </div>
    </section>
  );
}
