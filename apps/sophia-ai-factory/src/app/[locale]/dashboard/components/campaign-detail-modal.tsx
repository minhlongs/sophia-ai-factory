'use client';

import React, { useEffect, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useFormatter } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/seed/components/ui/dialog';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';
import { Progress } from '@/seed/components/ui/progress';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Campaign } from '@/seed/types';
import {
  X,
  PlayCircle,
  Calendar,
  User,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { useCampaignStream } from '@/forest/hooks/use-campaign-stream';
import { StepIndicator, Step } from '@/forest/components/progress/step-indicator';
import { createLogger } from '@/seed/utils/logger-utility';

const logger = createLogger('app/dashboard/components/campaign-detail-modal');

interface CampaignDetailModalProps {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    case 'failed':
      return <AlertCircle className="w-6 h-6 text-destructive" />;
    case 'queued':
      return <Clock className="w-6 h-6 text-muted-foreground" />;
    case 'draft':
      return <FileText className="w-6 h-6 text-muted-foreground" />;
    default:
      return <Loader2 className="w-6 h-6 text-primary motion-safe:animate-spin" />;
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
  return 'active';
}

/** Maps campaign status to the active pipeline step index for the step indicator. */
function statusToStepIndex(status: string): number {
  switch (status) {
    case 'processing_script': return 0;
    case 'processing_video': return 1;
    case 'processing_visual': return 2;
    case 'processing_compose': return 3;
    case 'publishing': return 4;
    case 'completed': return 5;
    case 'failed': return -1;
    default: return -1;
  }
}

/** Derives overall pipeline status from stream events and campaign status. */
function deriveStreamStatus(
  campaignStatus: string,
  events: { type: string; finalStatus?: string; terminal?: boolean }[],
  connected: boolean,
): 'active' | 'complete' | 'error' {
  if (campaignStatus === 'failed') return 'error';
  if (campaignStatus === 'completed') return 'complete';
  const streamEnd = events.find((e) => e.type === 'stream_end');
  if (streamEnd?.finalStatus === 'failed') return 'error';
  if (streamEnd?.finalStatus === 'completed') return 'complete';
  const terminalError = events.find((e) => e.type === 'error' && e.terminal);
  if (terminalError) return 'error';
  if (connected || campaignStatus.includes('processing') || campaignStatus === 'queued') return 'active';
  return 'active';
}

/** Extracts the latest progress value from stream events. */
function deriveProgress(events: { type: string; progress?: number }[], fallback: number): number {
  const latest = events.find((e) => e.type === 'progress_update');
  if (latest?.progress != null) return Math.min(100, Math.max(0, latest.progress));
  return fallback;
}

/** Extracts the latest status message from stream events. */
function deriveStatusMessage(events: { type: string; label?: string; message?: string }[]): string | undefined {
  const latest = events.find((e) => e.type === 'progress_update');
  if (latest?.label) return latest.label;
  const latestError = events.find((e) => e.type === 'error');
  if (latestError?.message) return latestError.message;
  return undefined;
}

const PIPELINE_STEPS: Step[] = [
  { id: 'script', label: 'Scripting', i18nKey: 'streaming.steps.script' },
  { id: 'tts', label: 'Text-to-Speech', i18nKey: 'streaming.steps.tts' },
  { id: 'visual', label: 'Visual Generation', i18nKey: 'streaming.steps.visual' },
  { id: 'compose', label: 'Compositing', i18nKey: 'streaming.steps.compose' },
  { id: 'publish', label: 'Publishing', i18nKey: 'streaming.steps.publish' },
];

export function CampaignDetailModal({ campaign, isOpen, onClose }: CampaignDetailModalProps) {
  const t = useTranslations('dashboard.campaigns.modal');
  const tStatus = useTranslations('campaign.status');
  const format = useFormatter();

  // Connect to SSE stream when the modal is open and we have a campaign
  const { events, connected, error: streamError, clearEvents } = useCampaignStream(
    isOpen && campaign ? campaign.id : null,
  );

  // Derive live state from stream events, falling back to campaign props
  const streamedStatus = useMemo(
    () => deriveStreamStatus(campaign?.status ?? '', events, connected),
    [campaign?.status, events, connected],
  );

  const streamedProgress = useMemo(
    () => deriveProgress(events, campaign?.progress ?? 0),
    [events, campaign?.progress],
  );

  const statusMessage = useMemo(
    () => deriveStatusMessage(events),
    [events],
  );

  const activeStepIndex = statusToStepIndex(campaign?.status ?? '');
  const isProcessing = campaign?.status?.includes('processing') || campaign?.status === 'queued';
  const isFailed = streamedStatus === 'error' || campaign?.status === 'failed';
  const isCompleted = streamedStatus === 'complete' || campaign?.status === 'completed';

  // Clear stale events when switching campaigns
  useEffect(() => {
    clearEvents();
  }, [campaign?.id, clearEvents]);

  // Log stream state for debugging
  useEffect(() => {
    if (campaign && isOpen) {
      logger.info('CampaignDetailModal stream state', {
        campaignId: campaign.id,
        connected,
        streamError,
        eventCount: events.length,
        derivedStatus: streamedStatus,
        derivedProgress: streamedProgress,
      });
    }
  }, [connected, streamError, events.length, campaign, isOpen, streamedStatus, streamedProgress]);

  const formatDate = useCallback((timestamp: string | number | undefined) => {
    if (!timestamp) return '-';
    const date = typeof timestamp === 'number'
      ? new Date(timestamp * 1000)
      : new Date(timestamp);
    return format.dateTime(date, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [format]);

  // Determine the error message to display
  const displayError = useMemo(() => {
    if (campaign?.error_message) return campaign.error_message;
    const streamErr = events.find((e) => e.type === 'error');
    if (streamErr?.message) return streamErr.message;
    if (streamError) return streamError;
    return undefined;
  }, [campaign?.error_message, events, streamError]);

  if (!campaign) return null;

  const progress = streamedProgress;
  const statusLabel = ['draft', 'queued', 'processing_script', 'processing_video', 'completed', 'failed'].includes(campaign.status as string)
    ? tStatus(campaign.status)
    : campaign.status?.replace(/_/g, ' ') || 'Unknown';
  const progressStatus = getProgressStatus(campaign.status);
  const hasVideo = !!campaign.video_url;
  const hasScript = !!campaign.script_content;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                {getStatusIcon(campaign.status)}
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {campaign.title || campaign.topic}
                </DialogTitle>
                <DialogDescription>
                  {t('created_on', { date: formatDate(campaign.created_at) })}
                </DialogDescription>
              </div>
            </div>
            <Badge variant={getStatusBadgeVariant(campaign.status)} className="shrink-0">
              {statusLabel}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Live Progress Section with Step Indicator */}
          {isProcessing && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Progress bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('progress')}</span>
                      <span className="font-semibold text-foreground">{progress}%</span>
                    </div>
                    <Progress
                      value={progress}
                      className="h-3"
                      aria-label={`${t('progress')}: ${progress}%`}
                    />
                  </div>

                  {/* Step indicator — shows pipeline stages */}
                  <StepIndicator
                    steps={PIPELINE_STEPS}
                    activeStep={activeStepIndex}
                    status={streamedStatus}
                    statusMessage={statusMessage}
                    progress={progress}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Message */}
          {displayError && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-destructive mb-1">
                      {t('error_title')}
                    </h4>
                    <p className="text-sm text-destructive/80">{displayError}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {t('field.audience')}
                    </p>
                    <p className="font-medium text-foreground">
                      {campaign.audience || t('field.not_specified')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      {t('field.updated')}
                    </p>
                    <p className="font-medium text-foreground">
                      {formatDate(campaign.updated_at || campaign.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Script Preview */}
          {hasScript && (
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h4 className="font-medium text-foreground">
                    {t('script_title')}
                  </h4>
                </div>
                <div className="bg-background rounded-lg p-4 border border-border">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-muted">
                    {typeof campaign.script_content === 'object' && campaign.script_content !== null
                      ? JSON.stringify(campaign.script_content, null, 2)
                      : String(campaign.script_content || '').slice(0, 1000)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Video Preview */}
          {hasVideo && (
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <PlayCircle className="w-4 h-4 text-muted-foreground" />
                  <h4 className="font-medium text-foreground">
                    {t('video_title')}
                  </h4>
                </div>
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                  <video
                    src={campaign.video_url!}
                    controls
                    className="w-full h-full object-contain"
                    preload="metadata"
                  >
                    {t('video_unsupported')}
                  </video>
                </div>
                <div className="mt-3 flex justify-center">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <a href={campaign.video_url!} target="_blank" rel="noopener noreferrer">
                      <PlayCircle className="w-4 h-4" />
                      {t('open_video_new_tab')}
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Template Info */}
          {campaign.template_id && (
            <Card className="bg-muted/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('template_id')}: {campaign.template_id}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('close')}
          </Button>
          {hasVideo && (
            <Button asChild className="gap-2">
              <a href={campaign.video_url!} target="_blank" rel="noopener noreferrer">
                <PlayCircle className="w-4 h-4" />
                {t('watch_video')}
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

CampaignDetailModal.displayName = 'CampaignDetailModal';
