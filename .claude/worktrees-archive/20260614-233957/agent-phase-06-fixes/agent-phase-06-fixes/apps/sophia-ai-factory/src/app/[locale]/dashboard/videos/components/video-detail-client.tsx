"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface VideoRow {
  id: string;
  title: string | null;
  status: "processing" | "completed" | "failed";
  video_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  heygen_job_id: string;
  script_request_id: string | null;
  error: string | null;
  created_at: number;
  updated_at: string | null;
}

interface HeygenStatus {
  status?: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
  error?: string | null;
}

const POLL_INTERVAL_MS = 5000;
const MAX_CONSECUTIVE_ERRORS = 5;

export function VideoDetailClient({ video: initial }: { video: VideoRow }) {
  const t = useTranslations("dashboard.videos");
  const [video, setVideo] = useState<VideoRow>(initial);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    if (video.status !== "processing") return;
    let cancelled = false;
    let errorCount = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/heygen/status/${encodeURIComponent(video.heygen_job_id)}`
        );
        if (!res.ok) throw new Error(`status ${res.status}`);
        const s = (await res.json()) as HeygenStatus;
        if (cancelled) return;
        errorCount = 0;
        if (!s?.status) return;
        if (s.status === "completed" || s.status === "failed") {
          setVideo((prev) => ({
            ...prev,
            status: s.status as VideoRow["status"],
            video_url: s.video_url ?? prev.video_url,
            thumbnail_url: s.thumbnail_url ?? prev.thumbnail_url,
            duration_sec:
              typeof s.duration === "number" ? s.duration : prev.duration_sec,
            error: s.error ?? prev.error,
          }));
          stop();
        }
      } catch {
        errorCount += 1;
        if (errorCount >= MAX_CONSECUTIVE_ERRORS) {
          if (!cancelled) setPollError(t("pollError"));
          stop();
        }
      }
    };
    timer = setInterval(tick, POLL_INTERVAL_MS);
    void tick();
    return () => {
      cancelled = true;
      stop();
    };
  }, [video.status, video.heygen_job_id, t]);

  return (
    <div className="space-y-4">
      <div className="aspect-video rounded border bg-muted overflow-hidden">
        {video.status === "completed" && video.video_url ? (
          <video
            src={video.video_url}
            controls
            poster={video.thumbnail_url ?? undefined}
            className="w-full h-full"
          />
        ) : video.status === "failed" ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-sm text-destructive p-4 text-center">
            <p className="font-medium">{t("renderFailed")}</p>
            {video.error && (
              <p className="text-xs mt-1 opacity-80">{video.error}</p>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground p-4 text-center">
            {pollError ? (
              <p className="text-destructive">{pollError}</p>
            ) : (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                {t("rendering")}
              </span>
            )}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">{t("status")}</dt>
          <dd className="font-medium capitalize">{video.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("duration")}</dt>
          <dd>
            {video.duration_sec ? `${video.duration_sec}s` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("heygenJob")}</dt>
          <dd className="font-mono text-xs">{video.heygen_job_id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("created")}</dt>
          <dd>{new Date(video.created_at * 1000).toLocaleString()}</dd>
        </div>
      </dl>

      {video.status === "completed" && video.video_url && (
        <div className="flex gap-2">
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent min-h-[44px] inline-flex items-center"
          >
            {t("openInNewTab")}
          </a>
          <a
            href={video.video_url}
            download
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 min-h-[44px] inline-flex items-center"
          >
            {t("download")}
          </a>
        </div>
      )}
    </div>
  );
}
