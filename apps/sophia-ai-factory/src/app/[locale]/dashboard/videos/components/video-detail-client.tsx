"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

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

export function VideoDetailClient({ video: initial }: { video: VideoRow }) {
  const [video, setVideo] = useState<VideoRow>(initial);

  useEffect(() => {
    if (video.status !== "processing") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/heygen/status/${encodeURIComponent(video.heygen_job_id)}`
        );
        if (!res.ok) return;
        const s = (await res.json()) as HeygenStatus;
        if (cancelled || !s?.status) return;
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
        }
      } catch {
        // swallow — keep polling
      }
    };
    const t = setInterval(tick, POLL_INTERVAL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [video.status, video.heygen_job_id]);

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
            <p className="font-medium">Render failed</p>
            {video.error && (
              <p className="text-xs mt-1 opacity-80">{video.error}</p>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Rendering...
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize">{video.status}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Duration</dt>
          <dd>
            {video.duration_sec ? `${video.duration_sec}s` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">HeyGen Job</dt>
          <dd className="font-mono text-xs">{video.heygen_job_id}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{new Date(video.created_at * 1000).toLocaleString()}</dd>
        </div>
      </dl>

      {video.status === "completed" && video.video_url && (
        <div className="flex gap-2">
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            Open in new tab
          </a>
          <a
            href={video.video_url}
            download
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}
