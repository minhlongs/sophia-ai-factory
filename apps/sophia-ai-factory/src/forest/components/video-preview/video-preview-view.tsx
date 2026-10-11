import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/seed/components/ui/card";
import { Button } from "@/seed/components/ui/button";
import { Loader2, Download, AlertCircle } from "lucide-react";
import { useCampaignStream } from "@/forest/hooks/use-campaign-stream";
import { StepIndicator } from "@/forest/components/progress/step-indicator";
import { createLogger } from "@/seed/utils/logger-utility";
import type { VideoPreviewProps } from "./types";
import { PIPELINE_STEPS } from "./types";
import {
  statusToStepIndex,
  deriveStatus,
  deriveProgress,
  deriveStatusMessage,
} from "./status-helpers";
import { PlayerViewport } from "./player-viewport";

const logger = createLogger('forest/components/video-preview');

export function VideoPreviewView({
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
            Generation Failed
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
        <PlayerViewport
          videoUrl={videoUrl}
          thumbnailUrl={thumbnailUrl}
          isPlaying={isPlaying}
          onPlay={() => setIsPlaying(true)}
          isStreaming={isStreaming}
        />
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
