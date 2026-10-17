'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/stitch';

export function CampaignsEmptyState({
  t,
  onCreateCampaign,
}: {
  t: (key: string) => string;
  onCreateCampaign?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08] flex items-center justify-center mb-6">
        <span className="text-2xl">🎬</span>
      </div>
      <h3 className="text-xl font-semibold text-foreground dark:text-white mb-2">
        {t('emptyState.title')}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">
        {t('emptyState.description')}
      </p>
      <Button
        onClick={onCreateCampaign}
        className="bg-primary hover:bg-primary/90 text-white shadow-sm hover:text-white"
      >
        <Plus className="w-4 h-4 mr-2" />
        {t('emptyState.cta')}
      </Button>
    </div>
  );
}
