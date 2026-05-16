"use client";

/**
 * help-video-player.tsx
 * Modal video player for help library. Shows R2-hosted video or placeholder text.
 *
 * @module app/[locale]/dashboard/help/help-video-player
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, Play } from "lucide-react";
import type { HelpVideo } from "@/forest/help/help-video-store";

interface HelpVideoPlayerProps {
  video: HelpVideo;
  locale: string;
  onClose: () => void;
}

export function HelpVideoPlayer({ video, locale, onClose }: HelpVideoPlayerProps) {
  const isVi = locale.startsWith("vi");
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const title = isVi ? video.title_vi : video.title_en;
  const description = isVi ? video.description_vi : video.description_en;
  const isPublished = video.published === 1;

  // Build R2 public URL (videos served from /videos/ path via R2 public bucket or worker)
  const videoUrl = video.r2_key ? `/api/help-video/${video.r2_key}` : null;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    closeBtnRef.current?.focus();
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100 truncate pr-4">{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label={isVi ? "Đóng" : "Close"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video area */}
        <div className="relative aspect-video bg-zinc-900 flex items-center justify-center">
          {isPublished && videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="absolute inset-0 w-full h-full"
              aria-label={title}
            >
              {isVi ? "Trình duyệt không hỗ trợ video." : "Your browser does not support video."}
            </video>
          ) : (
            /* Coming soon placeholder */
            <div className="flex flex-col items-center gap-3 text-center px-8">
              <div className="w-14 h-14 rounded-full bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                <Play className="w-7 h-7 text-violet-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                {isVi ? "Video sắp ra mắt" : "Video coming soon"}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                {isVi
                  ? "Nhà sáng lập đang ghi hình nội dung hướng dẫn. Xem lại sau!"
                  : "The founder is recording tutorial content. Check back soon!"}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="px-5 py-4">
          <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>
          {/* Link to full help center */}
          <div className="mt-3">
            <Link
              href="/dashboard/help"
              className="text-xs text-violet-400 hover:text-violet-300 hover:underline"
            >
              {isVi ? "Xem thêm tài nguyên hỗ trợ" : "Browse more help resources"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
