"use client";

import { useState, useRef } from "react";
import { clsx } from "clsx";

interface VideoPlayerProps {
  videoUrl: string;
  previewUrl?: string;
  title?: string;
  duration?: number;
  autoPlay?: boolean;
  className?: string;
}

export function VideoPlayer({
  videoUrl,
  previewUrl,
  title = "Generated Video",
  duration,
  autoPlay = false,
  className,
}: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    setIsPlaying(true);
    videoRef.current?.play();
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleLoaded = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setError("Failed to load video");
    setIsLoading(false);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={clsx("relative bg-black rounded-lg overflow-hidden", className)}>
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center">
            <p className="text-lg font-medium">{error}</p>
            <button
              onClick={() => window.open(videoUrl, "_blank")}
              className="mt-2 text-sm text-blue-400 hover:underline"
            >
              Open in new tab
            </button>
          </div>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={previewUrl}
        className="w-full h-full"
        controls
        onPlay={handlePlay}
        onPause={handlePause}
        onLoadedData={handleLoaded}
        onError={handleError}
        playsInline
      >
        Your browser does not support the video tag.
      </video>

      {/* Title overlay */}
      {title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">{title}</h3>
            {duration && (
              <span className="text-white/80 text-sm">
                {formatDuration(duration)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Play overlay (when not playing) */}
      {!isPlaying && !error && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors"
          aria-label="Play video"
        >
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-900 ml-1"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}

/**
 * Video player for proposals with embed support
 */
interface ProposalVideoPlayerProps {
  videoUrl: string;
  previewUrl?: string;
  proposalId: string;
  videoId: string;
}

export function ProposalVideoPlayer({
  videoUrl,
  previewUrl,
  proposalId,
  videoId,
}: ProposalVideoPlayerProps) {
  return (
    <div className="aspect-video">
      <VideoPlayer
        videoUrl={videoUrl}
        previewUrl={previewUrl}
        title={`Proposal Video`}
        className="w-full h-full"
      />
    </div>
  );
}
