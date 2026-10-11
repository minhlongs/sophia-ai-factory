import React from "react";
import Image from "next/image";
import { Button } from "@/seed/components/ui/button";
import { Play } from "lucide-react";

interface PlayerViewportProps {
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  isPlaying: boolean;
  onPlay: () => void;
  isStreaming: boolean;
}

export function PlayerViewport({
  videoUrl,
  thumbnailUrl,
  isPlaying,
  onPlay,
  isStreaming,
}: PlayerViewportProps) {
  if (videoUrl) {
    if (isPlaying) {
      return (
        <video
          src={videoUrl}
          controls
          autoPlay
          preload="metadata"
          className="w-full h-full object-cover"
          poster={thumbnailUrl || undefined}
          aria-label="AI-generated video preview"
        />
      );
    }
    return (
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
            onClick={onPlay}
            aria-label="Play video"
          >
            <Play className="w-8 h-8" aria-hidden="true" />
          </Button>
        </div>
      </div>
    );
  }

  if (!isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/50">
        <p>No video available</p>
      </div>
    );
  }

  return null;
}
