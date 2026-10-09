/**
 * First-Run Wizard Completion Card Component
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/completion-card
 */

// i18n-namespace: dashboard.missions.wizard

import React from 'react';
import { CheckCircle2, Video } from 'lucide-react';
import { Link } from '@/navigation';

export interface CompletionCardProps {
  t: (key: string) => string;
  missionId: string;
  onReset: () => void;
}

export function CompletionCard({ t, missionId, onReset }: CompletionCardProps) {
  return (
    <div className="rounded-xl border border-primary/30 bg-card p-6 text-center space-y-3">
      <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
      <h3 className="text-lg font-bold text-foreground">{t('successTitle')}</h3>
      <p className="text-sm text-muted-foreground">{t('successDescription')}</p>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href={`/dashboard/missions/${missionId}`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Video className="h-4 w-4" /> {t('reviewButton')}
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {t('createAnotherButton')}
        </button>
      </div>
    </div>
  );
}
