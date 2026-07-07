'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/seed/components/ui/card';
import { Badge } from '@/seed/components/ui/badge';
import { Button } from '@/seed/components/ui/button';
import { Progress } from '@/seed/components/ui/progress';
import { Campaign } from '@/seed/types';
import { PlayCircle, Eye, Clock, CheckCircle2, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormatter } from 'next-intl';
import { cn } from '@/seed/utils/cn';

interface CampaignCardProps {
  campaign: Campaign;
  onSelect: (campaign: Campaign) => void;
}

function getStatusIcon(status: string) {
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

function getStatusBadgeVariant(status: string): "default" | "destructive" | "outline" | "secondary" {
  switch (status) {
    case 'completed':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'queued':
      return 'outline';
    case 'draft':
      return 'default';
    default:
      return 'outline';
  }
}

function getProgressStatus(status: string | undefined): 'active' | 'complete' | 'error' {
  if (status === 'completed') return 'complete';
  if (status === 'failed') return 'error';
  if (status?.includes('processing') || status === 'queued') return 'active';
  // Default for any other status (shouldn't happen with progress bar shown)
  return 'active';
}

export function CampaignCard({ campaign, onSelect }: CampaignCardProps) {
  const t = useTranslations('dashboard.campaigns.card');
  const tStatus = useTranslations('campaign.status');
  const format = useFormatter();

  const statusLabel = ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'].includes(campaign.status as string)
    ? tStatus(campaign.status)
    : campaign.status?.replace(/_/g, ' ') || 'Unknown';

  const progress = campaign.progress || 0;
  const progressStatus = getProgressStatus(campaign.status);
  const hasVideo = !!campaign.video_url;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onSelect(campaign);
  };

  return (
    <Card
      className={cn(
        "group relative flex flex-col h-full transition-all duration-200",
        "hover:border-primary/50 hover:shadow-md cursor-pointer",
        "bg-surface-container-lowest border-outline-variant"
      )}
      onClick={handleClick}
      tabIndex={0}
      role="button"
      aria-label={`${t('view_campaign')}: ${campaign.title || campaign.topic}`}
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
                day: 'numeric'
              })}
            </p>
          </div>
        </div>
        <Badge variant={getStatusBadgeVariant(campaign.status)} className="ml-2 shrink-0">
          {statusLabel}
        </Badge>
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
            <Progress
              value={progress}
              className={cn(
                "h-2",
                progressStatus === 'active' && "bg-primary/10 dark:bg-primary/10/30",
                progressStatus === 'complete' && "bg-green-100 dark:bg-green-900/30",
                progressStatus === 'error' && "bg-red-100 dark:bg-red-900/30"
              )}
              indicatorClassName={cn(
                progressStatus === 'active' && "bg-primary/10 dark:bg-primary/10",
                progressStatus === 'complete' && "bg-green-600 dark:bg-green-400",
                progressStatus === 'error' && "bg-red-600 dark:bg-red-400"
              )}
            />
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
              className="flex items-center gap-1 text-xs text-primary dark:text-primary hover:text-primary dark:hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {t('watch_video')}
            </Link>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-8 px-2"
          onClick={handleClick}
        >
          {t('view_details')}
        </Button>
      </CardFooter>
    </Card>
  );
}

CampaignCard.displayName = 'CampaignCard';
