'use client';

import React from 'react';
import { Campaign } from '@/seed/types';
import { CampaignCard } from './campaign-card';
import { cn } from '@/seed/utils/cn';

interface CampaignGridProps {
  campaigns: Campaign[];
  onCampaignSelect: (campaign: Campaign) => void;
  className?: string;
}

export function CampaignGrid({ campaigns, onCampaignSelect, className }: CampaignGridProps) {
  if (campaigns.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
        className
      )}
    >
      {campaigns.map((campaign) => (
        <CampaignCard
          key={campaign.id}
          campaign={campaign}
          onSelect={onCampaignSelect}
        />
      ))}
    </div>
  );
}

CampaignGrid.displayName = 'CampaignGrid';
