'use client';

import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Button } from '@/components/stitch';

interface DiscoveryEmptyStateProps {
  onResetFilters: () => void;
  t: (key: string) => string;
}

export function DiscoveryEmptyState({ onResetFilters, t }: DiscoveryEmptyStateProps) {
  return (
    <div
      role="region"
      aria-label="Empty State"
      className="text-center py-12 px-4 rounded-2xl bg-card/50 dark:bg-white/[0.02] border border-border dark:border-white/[0.06]"
    >
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
        <Search className="w-6 h-6" />
      </div>
      <h4 className="text-base font-bold text-foreground dark:text-white">
        {t('emptySearch')}
      </h4>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Try adjusting your category, payout model, or search terms to discover more partner programs.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onResetFilters}
        className="mt-4"
        iconLeft={<RotateCcw className="w-4 h-4" />}
      >
        {t('resetFilters')}
      </Button>
    </div>
  );
}
