'use client';

import React from 'react';
import { CATEGORIES, PAYOUT_MODELS } from './constants';

export interface DiscoveryFilterPillsProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  selectedPayoutModel: string;
  onSelectPayoutModel: (model: string) => void;
  t: (key: string) => string;
}

export function DiscoveryFilterPills({
  selectedCategory,
  onSelectCategory,
  selectedPayoutModel,
  onSelectPayoutModel,
  t,
}: DiscoveryFilterPillsProps) {
  return (
    <div className="mt-4 pt-4 border-t border-border dark:border-white/[0.06] space-y-3">
      {/* Category Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 sm:w-28">
          {t('categories.label')}:
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('categories.label')}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory.toLowerCase() === cat.id.toLowerCase();
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-on-primary font-bold shadow-sm shadow-primary/20'
                    : 'bg-black/[0.04] dark:bg-white/[0.04] text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
                }`}
              >
                {t(`categories.${cat.key}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Payout Model Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0 sm:w-28">
          {t('payoutModels.label')}:
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('payoutModels.label')}>
          {PAYOUT_MODELS.map((model) => {
            const isSelected = selectedPayoutModel.toLowerCase() === model.id.toLowerCase();
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => onSelectPayoutModel(model.id)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-secondary text-on-secondary font-bold shadow-sm shadow-secondary/20'
                    : 'bg-black/[0.04] dark:bg-white/[0.04] text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/[0.08] dark:hover:bg-white/[0.08]'
                }`}
              >
                {t(`payoutModels.${model.key}`)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
