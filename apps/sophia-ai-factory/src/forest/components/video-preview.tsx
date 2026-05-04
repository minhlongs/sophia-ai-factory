"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/seed/components/ui/card";
import { Button } from "@/seed/components/ui/button";
import { Loader2, Play, Download, AlertCircle } from "lucide-react";

interface VideoPreviewProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  status: "draft" | "queued" | "processing_script" | "processing_video" | "completed" | "failed";
  progress?: number;
  errorMessage?: string | null;
  campaignId: string;
}

export function VideoPreview({
  videoUrl,
  thumbnailUrl,
  status,
  progress = 0,
  errorMessage,
}: VideoPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const isLoading = status === "processing_video" || status === "queued" || status === "processing_script";
  const isFailed = status === "failed";
  const isCompleted = status === "completed";

  const handlePlay = () => {
    setIsPlaying(true);
  };

  if (isFailed) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertCircle className="w-5 h-5 mr-2" aria-hidden="true" />
            Generation Failed
          </CardTitle>
          <CardDescription>
            {errorMessage || "An error occurred while generating your video."}
          </CardDescription>
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
          {isLoading
            ? `Generating your video... ${progress}%`
            : "Your AI-generated video is ready."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 relative aspect-video bg-black/5 group">
        {isLoading ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 backdrop-blur-sm z-10"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="w-10 h-10 motion-safe:animate-spin text-primary mb-4" aria-hidden="true" />
            <p className="text-sm text-muted-foreground font-medium">
              {status === "processing_script" && "Writing script & generating voice..."}
              {status === "processing_video" && "Rendering video avatar..."}
              {status === "queued" && "Queued for generation..."}
            </p>
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Video generation progress: ${progress}%`}
              className="w-48 h-1.5 bg-muted mt-4 rounded-full overflow-hidden"
            >
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

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
                  onClick={handlePlay}
                  aria-label="Play video"
                >
                  <Play className="w-8 h-8" />
                </Button>
              </div>
            </div>
          )
        ) : (
          !isLoading && (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/50">
               <p>No video available</p>
             </div>
          )
        )}
      </CardContent>
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
