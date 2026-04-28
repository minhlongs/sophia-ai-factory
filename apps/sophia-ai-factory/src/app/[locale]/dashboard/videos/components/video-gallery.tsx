"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { localizedHref } from "@/lib/i18n/localized-href";

interface VideoItem {
  id: string;
  title: string | null;
  status: "processing" | "completed" | "failed";
  video_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  heygen_job_id: string;
  created_at: number;
}

interface VideosResponse {
  videos: VideoItem[];
  pagination: { limit: number; offset: number; count: number };
}

export function VideoGallery({ locale }: { locale?: string }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/videos?limit=50");
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = (await res.json()) as VideosResponse;
        if (active) setVideos(data.videos ?? []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading videos...
      </div>
    );
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (videos.length === 0) {
    return (
      <div className="rounded border border-dashed p-12 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          No videos yet. Create your first one.
        </p>
        <Link
          href={localizedHref(locale, "/dashboard/videos/new")}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          New Video →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} locale={locale} />
      ))}
    </div>
  );
}

function VideoCard({ video, locale }: { video: VideoItem; locale?: string }) {
  const created = new Date(video.created_at * 1000).toLocaleDateString();
  return (
    <Link
      href={localizedHref(locale, `/dashboard/videos/${video.id}`)}
      className="block rounded border overflow-hidden hover:border-primary transition cursor-pointer"
    >
      <div className="aspect-video bg-muted relative">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title ?? "Video thumbnail"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            {video.status === "processing" ? "Rendering..." : "No preview"}
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${statusColor(
            video.status
          )}`}
        >
          {video.status}
        </span>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium truncate">
          {video.title ?? "Untitled"}
        </p>
        <p className="text-xs text-muted-foreground">{created}</p>
      </div>
    </Link>
  );
}

function statusColor(status: VideoItem["status"]): string {
  if (status === "completed") return "bg-green-500/15 text-green-700";
  if (status === "failed") return "bg-destructive/15 text-destructive";
  return "bg-yellow-500/15 text-yellow-700";
}
