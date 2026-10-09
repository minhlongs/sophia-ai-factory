/**
 * First-Run Wizard CEO Questions Guide Component
 * Layer: components/missions (UI Presentation)
 *
 * @module components/missions/first-run/ceo-questions-guide
 */

// i18n-namespace: dashboard.missions.wizard

import React from 'react';

export interface CeoQuestionsGuideProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  costEstimate: { totalUsd: number; totalMcu: number };
}

export function CeoQuestionsGuide({ t, costEstimate }: CeoQuestionsGuideProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <p className="font-semibold text-primary">{t('guide.q1_label')}</p>
          <p className="text-muted-foreground">{t('guide.q1_desc')}</p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q2_label')}</p>
          <p className="text-muted-foreground">{t('guide.q2_desc')}</p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q3_label')}</p>
          <p className="text-muted-foreground">{t('guide.q3_desc')}</p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q4_label')}</p>
          <p className="text-muted-foreground">
            {t('guide.q4_desc', { usd: costEstimate.totalUsd, mcu: costEstimate.totalMcu })}
          </p>
        </div>
        <div>
          <p className="font-semibold text-primary">{t('guide.q5_label')}</p>
          <p className="text-muted-foreground">{t('guide.q5_desc')}</p>
        </div>
      </div>
    </div>
  );
}
