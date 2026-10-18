'use client';

// i18n-namespace: stitch.affiliates.drawer

import React from 'react';
import { Sparkles, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/stitch';

export type AdoptTarget = 'creator_studio' | 'distribution_queue';

export interface DrawerFooterActionsProps {
  adoptingTarget: AdoptTarget | null;
  onAdopt: (target: AdoptTarget) => void;
  t: (key: string) => string;
}

export function DrawerFooterActions({
  adoptingTarget,
  onAdopt,
  t,
}: DrawerFooterActionsProps) {
  return (
    <div className="pt-6 border-t border-border dark:border-white/[0.08] mt-6 flex flex-col sm:flex-row gap-3">
      <Button
        variant="primary"
        size="lg"
        className="flex-1"
        disabled={adoptingTarget !== null}
        onClick={() => onAdopt('creator_studio')}
        iconLeft={
          adoptingTarget === 'creator_studio' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )
        }
      >
        {adoptingTarget === 'creator_studio' ? t('adopting') : t('adoptCreatorStudio')}
      </Button>

      <Button
        variant="outline"
        size="lg"
        className="flex-1"
        disabled={adoptingTarget !== null}
        onClick={() => onAdopt('distribution_queue')}
        iconLeft={
          adoptingTarget === 'distribution_queue' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Layers className="w-4 h-4" />
          )
        }
      >
        {adoptingTarget === 'distribution_queue' ? t('adopting') : t('queueDistribution')}
      </Button>
    </div>
  );
}
