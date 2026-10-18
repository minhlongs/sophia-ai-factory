'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardFooter, CardHeader } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { CampaignStatusBadge } from './campaign-status-badge';
import { CampaignCardBody, getCampaignStatusIcon } from './campaign-card-body';
import { cn } from '@/seed/utils/cn';
import { useTranslations, useFormatter } from 'next-intl';
import { PlayCircle } from 'lucide-react';
import { CampaignCardProps } from './types';

export function CampaignCard({
  campaign,
  onSelect,
  className,
}: CampaignCardProps) {
  const t = useTranslations('dashboard.campaigns.card');
  const format = useFormatter();

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
            {getCampaignStatusIcon(campaign.status)}
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

      <CampaignCardBody
        campaign={campaign}
        progress={progress}
        progressLabel={t('progress')}
      />

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
