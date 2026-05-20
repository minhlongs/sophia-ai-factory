"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("dashboard.videos");
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
    // Skeleton grid mirrors the final card layout so the page reserves space
    // and there is no CLS when the real videos arrive.
    return (
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        aria-busy="true"
        aria-label={t("loading")}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded border overflow-hidden">
            <div className="aspect-video bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-1/3 rounded bg-muted/70 animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  if (videos.length === 0) {
    return (
      <div className="rounded border border-dashed p-12 text-center space-y-2">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
        <Link
          href={localizedHref(locale, "/dashboard/videos/new")}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("newVideoLink")}
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
  const t = useTranslations("dashboard.videos");
  const created = new Date(video.created_at * 1000).toLocaleDateString();
  return (
    <Link
      href={localizedHref(locale, `/dashboard/videos/${video.id}`)}
      className="block rounded border overflow-hidden hover:border-primary transition cursor-pointer"
    >
      <div className="aspect-video bg-muted relative">
        {video.thumbnail_url ? (
          <Image
            src={video.thumbnail_url}
            alt={video.title ?? t("untitled")}
            width={400}
            height={225}
            loading="lazy"
            unoptimized
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
            {video.status === "processing" ? t("rendering") : t("noPreview")}
          </div>
        )}
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded ${statusColor(
            video.status
          )}`}
        >
          {t(`statusLabel.${video.status}`)}
        </span>
      </div>
      <div className="p-3 space-y-1">
        <p className="text-sm font-medium truncate">
          {video.title ?? t("untitled")}
        </p>
        <p className="text-xs text-muted-foreground">{created}</p>
      </div>
    </Link>
  );
}

// Dark theme is default — the prior `text-green-700` / `text-yellow-700` over
// `bg-*-500/15` fell to ~3.8:1 contrast, below AA. Light/dark token pairs below
// pass AA in both modes against the muted backdrop.
function statusColor(status: VideoItem["status"]): string {
  if (status === "completed")
    return "bg-green-500/15 text-green-700 dark:text-green-300";
  if (status === "failed") return "bg-destructive/15 text-destructive";
  return "bg-yellow-500/15 text-yellow-800 dark:text-yellow-200";
}
