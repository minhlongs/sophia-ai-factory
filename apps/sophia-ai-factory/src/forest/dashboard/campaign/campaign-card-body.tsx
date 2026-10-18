'use client';

import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
} from 'lucide-react';
import { CardContent } from '@/seed/components/ui/card';
import { CampaignProgressBar } from './campaign-progress-bar';
import type { Campaign, CampaignStatus } from '@/seed/types';

export function getCampaignStatusIcon(status: CampaignStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5 text-green-500" aria-hidden="true" />;
    case 'failed':
      return <AlertCircle className="w-5 h-5 text-destructive" aria-hidden="true" />;
    case 'queued':
      return <Clock className="w-5 h-5 text-muted-foreground" aria-hidden="true" />;
    case 'draft':
      return <FileText className="w-5 h-5 text-muted-foreground" aria-hidden="true" />;
    default:
      return <Loader2 className="w-5 h-5 text-primary motion-safe:animate-spin" aria-hidden="true" />;
  }
}

export interface CampaignCardBodyProps {
  campaign: Campaign;
  progress: number;
  progressLabel: string;
}

export function CampaignCardBody({
  campaign,
  progress,
  progressLabel,
}: CampaignCardBodyProps) {
  return (
    <CardContent className="flex-1 pb-4">
      {campaign.audience && (
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {campaign.audience}
        </p>
      )}

      {(campaign.status?.includes('processing') || campaign.status === 'queued') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{progressLabel}</span>
            <span className="font-medium text-foreground">{progress}%</span>
          </div>
          <CampaignProgressBar progress={progress} status={campaign.status} />
        </div>
      )}

      {campaign.error_message && (
        <p className="text-xs text-destructive mt-2 line-clamp-2">
          {campaign.error_message}
        </p>
      )}
    </CardContent>
  );
}
