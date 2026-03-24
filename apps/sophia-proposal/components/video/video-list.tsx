"use client";

import { useEffect, useState, useCallback } from "react";
import { VideoPlayer } from "./video-player";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import { VideoGeneratorDialog } from "./video-generator";

export interface VideoAsset {
  id: string;
  videoType: "intro" | "section" | "full_proposal" | "custom";
  status: "pending" | "processing" | "ready" | "failed";
  videoUrl?: string;
  previewUrl?: string;
  duration?: number;
  mcuCost: number;
  createdAt: string;
  readyAt?: string;
  errorMessage?: string;
}

interface VideoListProps {
  proposalId: string;
  onVideoSelect?: (video: VideoAsset) => void;
  className?: string;
}

interface VideoGeneratorProps {
  proposalId: string;
  onGenerated?: (videoId: string) => void;
}

export function VideoList({ proposalId, onVideoSelect, className }: VideoListProps) {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      const response = await fetch(`/api/video/proposal/${proposalId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch videos");
      }

      setVideos(data.videos || []);

      // Check if any videos are still processing
      const hasProcessing = data.videos?.some(
        (v: VideoAsset) => v.status === "pending" || v.status === "processing"
      );

      if (hasProcessing && !pollingInterval) {
        // Start polling every 5 seconds for processing videos
        const interval = setInterval(() => {
          fetchVideos();
        }, 5000);
        setPollingInterval(interval);
      } else if (!hasProcessing && pollingInterval) {
        // Stop polling when all videos are done
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setIsLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    fetchVideos();

    // Cleanup polling on unmount
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [proposalId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ready":
        return "Ready";
      case "processing":
        return "Processing...";
      case "pending":
        return "Pending";
      case "failed":
        return "Failed";
      default:
        return status;
    }
  };

  const getVideoTypeLabel = (type: string) => {
    switch (type) {
      case "intro":
        return "Intro";
      case "section":
        return "Section";
      case "full_proposal":
        return "Full Proposal";
      case "custom":
        return "Custom";
      default:
        return type;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className={clsx("flex items-center justify-center py-12", className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={clsx("text-center py-12", className)}>
        <p className="text-red-600">{error}</p>
        <Button onClick={fetchVideos} aria-label="Retry" className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className={clsx("text-center py-12 text-gray-500", className)}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        <p className="mt-2">No videos generated yet</p>
      </div>
    );
  }

  return (
    <div className={clsx("space-y-6", className)}>
      {videos.map((video) => (
        <div
          key={video.id}
          className="border border-gray-200 rounded-lg overflow-hidden"
        >
          <div className="grid md:grid-cols-2 gap-4 p-4">
            {/* Video Preview */}
            <div>
              {video.status === "ready" && video.videoUrl ? (
                <VideoPlayer
                  videoUrl={video.videoUrl}
                  previewUrl={video.previewUrl}
                  duration={video.duration}
                  className="aspect-video"
                />
              ) : (
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  {video.status === "failed" ? (
                    <div className="text-center text-gray-500">
                      <svg
                        className="mx-auto h-12 w-12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="mt-2 text-sm">{video.errorMessage}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="animate-pulse text-4xl">🎬</div>
                      <p className="mt-2 text-sm text-gray-500">
                        {getStatusLabel(video.status)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={clsx(
                      "px-2 py-1 rounded text-xs font-medium",
                      getStatusColor(video.status)
                    )}
                  >
                    {getStatusLabel(video.status)}
                  </span>
                  <span className="text-sm text-gray-500">
                    {getVideoTypeLabel(video.videoType)}
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Duration</span>
                    <span>{formatDuration(video.duration) || "Pending"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">MCU Cost</span>
                    <span className="text-blue-600">{video.mcuCost} MCU</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Created</span>
                    <span>{formatDate(video.createdAt)}</span>
                  </div>
                  {video.readyAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Completed</span>
                      <span>{formatDate(video.readyAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {video.status === "ready" && video.videoUrl && (
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() =>
                      window.open(video.videoUrl, "_blank")
                    }
                  >
                    Open in New Tab
                  </Button>
                  {onVideoSelect && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onVideoSelect(video)}
                    >
                      Select
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Video Generator component (button to open generator dialog)
 */
export function VideoGenerator({ proposalId, onGenerated }: VideoGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSuccess = (videoId: string) => {
    setIsOpen(false);
    onGenerated?.(videoId);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Generate Video
      </Button>

      {isOpen && (
        <VideoGeneratorDialog
          proposalId={proposalId}
          onSuccess={handleSuccess}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
