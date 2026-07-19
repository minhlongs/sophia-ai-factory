"use client";

/**
 * help-videos-library.tsx
 * Grid of help video cards (thumbnails + play button).
 * Accepts pre-fetched videos as props (Server Component fetches, hands to client).
 *
 * @module app/[locale]/dashboard/help/help-videos-library
 */

import Image from "next/image";
import { useState } from "react";
import type { HelpVideo } from "@/forest/help/help-video-store";
import { HelpVideoPlayer } from "./help-video-player";

interface HelpVideosLibraryProps {
  videos: HelpVideo[];
  locale: string;
}

export function HelpVideosLibrary({ videos, locale }: HelpVideosLibraryProps) {
  const [selected, setSelected] = useState<HelpVideo | null>(null);
  const isVi = locale.startsWith("vi");

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {videos.map((video, idx) => {
          const title = isVi ? video.title_vi : video.title_en;
          const thumbSrc = `/help/placeholder-${idx + 1}.svg`;
          const isPublished = video.published === 1;

          return (
            <button
              key={video.id}
              type="button"
              onClick={() => setSelected(video)}
              className="group relative rounded-xl overflow-hidden border border-border-800 bg-muted-900/60 hover:border-primary-500/60 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={title}
            >
              {/* Thumbnail */}
              <div className="relative aspect-video w-full">
                <Image
                  src={thumbSrc}
                  alt=""
                  fill
                  className="object-cover"
                  aria-hidden="true"
                  unoptimized
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-primary-500/80 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {/* Coming soon badge for unpublished */}
                {!isPublished && (
                  <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-muted-800/90 border border-border-700 text-muted-foreground-400">
                    {isVi ? "Sắp ra mắt" : "Coming soon"}
                  </span>
                )}
                {/* Duration badge for published */}
                {isPublished && video.duration_sec > 0 && (
                  <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/70 text-muted-foreground-300 tabular-nums">
                    {formatDuration(video.duration_sec)}
                  </span>
                )}
              </div>

              {/* Title */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-muted-foreground-200 group-hover:text-white leading-snug line-clamp-2">
                  {title}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Player modal */}
      {selected && (
        <HelpVideoPlayer
          video={selected}
          locale={locale}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
