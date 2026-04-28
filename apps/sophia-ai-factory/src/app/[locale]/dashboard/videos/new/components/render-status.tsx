"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { VideoStatus } from "@/lib/services/types";

interface RenderStatusProps {
  videoId: string;
}

const POLL_INTERVAL_MS = 5000;
const TERMINAL: VideoStatus["status"][] = ["completed", "failed"];

export function RenderStatus({ videoId }: RenderStatusProps) {
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/heygen/status/${encodeURIComponent(videoId)}`);
        if (!res.ok) throw new Error(`Status fetch failed (${res.status})`);
        const data = (await res.json()) as VideoStatus;
        if (!active) return;
        setStatus(data);
        if (!TERMINAL.includes(data.status)) {
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unknown error");
      }
    };

    poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [videoId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!status) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Initializing render...</div>;

  if (status.status === "completed" && status.video_url) {
    return (
      <div className="space-y-3">
        <h3 className="font-medium">Video ready</h3>
        <video src={status.video_url} controls className="w-full rounded border" />
        <p className="text-xs text-muted-foreground">Video ID: {videoId}</p>
      </div>
    );
  }

  if (status.status === "failed") {
    return (
      <div className="rounded border border-destructive p-4 space-y-2">
        <p className="font-medium text-destructive">Render failed</p>
        {status.error && <p className="text-sm">{status.error}</p>}
        <p className="text-xs text-muted-foreground">Video ID: {videoId}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Loader2 className="h-4 w-4 animate-spin" />
      Rendering... ({status.status})
      <span className="ml-auto text-xs text-muted-foreground">{videoId}</span>
    </div>
  );
}
