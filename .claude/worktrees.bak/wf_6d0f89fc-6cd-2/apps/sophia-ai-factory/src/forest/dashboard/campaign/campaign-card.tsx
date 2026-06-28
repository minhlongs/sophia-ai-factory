'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { CampaignStatusBadge } from './campaign-status-badge';
import { CampaignProgressBar } from './campaign-progress-bar';
import { cn } from '@/seed/utils/cn';
import { Campaign, CampaignStatus } from '@/seed/types';
import { useTranslations } from 'next-intl';
import { useFormatter } from 'next-intl';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
  PlayCircle,
} from 'lucide-react';
import { CampaignCardProps } from './types';

function getStatusIcon(status: CampaignStatus) {
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

export function CampaignCard({
  campaign,
  onSelect,
  className,
}: CampaignCardProps) {
  const t = useTranslations('dashboard.campaigns.card');
  const tStatus = useTranslations('campaign.status');
  const format = useFormatter();

  const statusLabel = tStatus(campaign.status);
  const progress = campaign.progress ?? 0;
  const hasVideo = !!campaign.video_url;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onSelect(campaign);
  };

  return (
    <Card
      className={cn(
        'group relative flex flex-col h-full transition-all duration-200',
        'hover:border-primary/50 hover:shadow-md cursor-pointer',
        'bg-surface-container-lowest border-outline-variant',
        className
      )}
      onClick={handleClick}
      tabIndex={0}
      role="button"
      aria-label={`${t('view_campaign')}: ${campaign.title || campaign.topic || ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(campaign);
        }
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            {getStatusIcon(campaign.status)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate" title={campaign.title || campaign.topic || ''}>
              {campaign.title || campaign.topic || ''}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format.dateTime(new Date(campaign.created_at), {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          </div>
        </div>
        <CampaignStatusBadge status={campaign.status} className="ml-2 shrink-0" />
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        {campaign.audience && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {campaign.audience}
          </p>
        )}

        {(campaign.status?.includes('processing') || campaign.status === 'queued') && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('progress')}</span>
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

      <CardFooter className="flex items-center justify-between pt-4 border-t border-outline-variant mt-auto">
        <div className="flex items-center gap-2">
          {hasVideo && (
            <Link
              href={campaign.video_url!}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {t('watch_video')}
            </Link>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-xs h-8 px-2" onClick={handleClick}>
          {t('view_details')}
        </Button>
      </CardFooter>
    </Card>
  );
}

CampaignCard.displayName = 'CampaignCard';
