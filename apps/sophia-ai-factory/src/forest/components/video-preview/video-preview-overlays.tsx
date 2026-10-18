import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/seed/components/ui/card";
import { Button } from "@/seed/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { StepIndicator } from "@/forest/components/progress/step-indicator";
import { PIPELINE_STEPS } from "./types";

export interface VideoPreviewFailedCardProps {
  displayError: string;
}

export function VideoPreviewFailedCard({ displayError }: VideoPreviewFailedCardProps) {
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

export interface VideoPreviewLoadingOverlayProps {
  statusMessage?: string;
  activeStepIndex: number;
  streamedStatus: 'active' | 'complete' | 'error';
  streamedProgress: number;
}

export function VideoPreviewLoadingOverlay({
  statusMessage,
  activeStepIndex,
  streamedStatus,
  streamedProgress,
}: VideoPreviewLoadingOverlayProps) {
  return (
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
  );
}
