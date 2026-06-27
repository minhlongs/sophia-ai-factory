"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/seed/components/ui/card";
import { Button } from "@/seed/components/ui/button";
import { Badge } from "@/seed/components/ui/badge";
import { Loader2, Play, Download, AlertCircle } from "lucide-react";
import { useCampaignStream } from "@/forest/hooks/use-campaign-stream";
import { StepIndicator, Step } from "@/forest/components/progress/step-indicator";
import { createLogger } from "@/seed/utils/logger-utility";

const logger = createLogger('forest/components/video-preview');

/** Maps campaign status strings to the active pipeline step index. */
function statusToStepIndex(status: string): number {
  switch (status) {
    case 'processing_script':
      return 0; // scripting
    case 'processing_video':
      return 1; // tts
    case 'processing_visual':
      return 2; // visual
    case 'processing_compose':
      return 3; // compose
    case 'publishing':
      return 4; // publish
    case 'completed':
      return 5;
    case 'failed':
      return -1;
    default:
      return -1;
  }
}

/** Derives the overall pipeline status from the latest stream events. */
function deriveStatus(
  campaignStatus: string,
  events: { type: string; status?: string; finalStatus?: string; terminal?: boolean }[],
  connected: boolean,
): 'active' | 'complete' | 'error' {
  if (campaignStatus === 'failed') return 'error';
  if (campaignStatus === 'completed') return 'complete';
  // If we have a terminal stream_end event, trust its finalStatus
  const streamEnd = events.find((e) => e.type === 'stream_end');
  if (streamEnd?.finalStatus) {
    if (streamEnd.finalStatus === 'failed') return 'error';
    if (streamEnd.finalStatus === 'completed') return 'complete';
  }
  // If a terminal error event arrived, surface error
  const terminalError = events.find((e) => e.type === 'error' && e.terminal);
  if (terminalError) return 'error';
  // Connected and no terminal signal — still active
  if (connected || campaignStatus.includes('processing') || campaignStatus === 'queued') {
    return 'active';
  }
  return 'active';
}

/** Extracts the latest progress value from stream events. */
function deriveProgress(
  events: { type: string; progress?: number }[],
  fallback: number,
): number {
  const latest = events.find((e) => e.type === 'progress_update');
  if (latest?.progress != null) return Math.min(100, Math.max(0, latest.progress));
  return fallback;
}

/** Extracts the latest status message from stream events. */
function deriveStatusMessage(
  events: { type: string; label?: string; message?: string }[],
): string | undefined {
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

interface VideoPreviewProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  status: "draft" | "queued" | "processing_script" | "processing_video" | "completed" | "failed";
  progress?: number;
  errorMessage?: string | null;
  campaignId: string;
  /** When true, force static mode (skip SSE connection). */
  staticMode?: boolean;
}

export function VideoPreview({
  videoUrl,
  thumbnailUrl,
  status,
  progress = 0,
  errorMessage,
  campaignId,
  staticMode = false,
}: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Connect to SSE stream unless static mode is requested
  const { events, connected, error: streamError } = useCampaignStream(
    staticMode ? null : campaignId,
  );

  // Derive live state from stream events, falling back to props
  const streamedStatus = useMemo(
    () => deriveStatus(status, events, connected),
    [status, events, connected],
  );

  const streamedProgress = useMemo(
    () => deriveProgress(events, progress),
    [events, progress],
  );

  const statusMessage = useMemo(
    () => deriveStatusMessage(events),
    [events],
  );

  const activeStepIndex = statusToStepIndex(status);
  const isStreaming = !staticMode && (status === 'processing_script' || status === 'processing_video' || status === 'queued');
  const isFailed = streamedStatus === 'error' || status === 'failed';
  const isCompleted = streamedStatus === 'complete' || status === 'completed';

  // Log connection state changes for debugging
  useEffect(() => {
    if (!staticMode) {
      logger.info('VideoPreview stream state', {
        campaignId,
        connected,
        streamError,
        eventCount: events.length,
      });
    }
  }, [connected, streamError, events.length, campaignId, staticMode]);

  // Failed state — show error card
  if (isFailed) {
    const displayError = streamError || errorMessage || 'An error occurred while generating your video.';
    return (
      <Card className="w-full max-w-2xl mx-auto border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertCircle className="w-5 h-5 mr-2" aria-hidden="true" />
            {isStreaming ? 'Generation Failed' : 'Generation Failed'}
          </CardTitle>
          <CardDescription>{displayError}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden">
      <CardHeader>
        <CardTitle>Video Preview</CardTitle>
        <CardDescription>
          {isStreaming
            ? `${statusMessage || 'Generating your video...'} ${streamedProgress}%`
            : isCompleted
              ? 'Your AI-generated video is ready.'
              : 'Your AI-generated video is ready.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0 relative aspect-video bg-black/5 group">
        {/* Loading overlay with step indicators */}
        {isStreaming ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 backdrop-blur-sm z-10"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-10 h-10 motion-safe:animate-spin text-primary mb-4" aria-hidden="true" />
            <p className="text-sm text-muted-foreground font-medium mb-4">
              {statusMessage || 'Generating your video...'}
            </p>

            {/* Inline step indicators while loading */}
            <div className="w-full max-w-xs px-4">
              <StepIndicator
                steps={PIPELINE_STEPS}
                activeStep={activeStepIndex}
                status={streamedStatus}
                progress={streamedProgress}
                className="border-0 shadow-none bg-transparent"
              />
            </div>
          </div>
        ) : null}

        {/* Video or thumbnail */}
        {videoUrl ? (
          isPlaying ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              preload="metadata"
              className="w-full h-full object-cover"
              poster={thumbnailUrl || undefined}
              aria-label="AI-generated video preview"
            />
          ) : (
            <div className="relative w-full h-full">
              {thumbnailUrl && (
                <Image
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  fill
                  sizes="(max-width: 672px) 100vw, 672px"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                <Button
                  size="icon"
                  className="w-16 h-16 rounded-full pl-1 bg-primary text-primary-foreground hover:bg-primary/90 border-0"
                  onClick={() => setIsPlaying(true)}
                  aria-label="Play video"
                >
                  <Play className="w-8 h-8" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )
        ) : (
          !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/50">
              <p>No video available</p>
            </div>
          )
        )}
      </CardContent>

      {/* Download button for completed videos */}
      {isCompleted && videoUrl && (
        <div className="p-4 flex justify-end border-t border-border bg-muted/10">
          <Button variant="outline" size="sm" asChild>
            <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              Download Video
            </a>
          </Button>
        </div>
      )}
    </Card>
  );
}
