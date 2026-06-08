"use client";

/**
 * help-tooltip.tsx
 * "?" icon that opens a modal with route-specific intro text + optional video link.
 * Used as a single-line addition at the top of each targeted route layout/page.
 *
 * @module components/help/help-tooltip
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { HelpCircle, X, Play, ExternalLink } from "lucide-react";

export interface HelpTooltipContent {
  /** 30-second intro text shown in modal */
  introEn: string;
  introVi: string;
  /** Optional: slug of help_videos row to link to */
  videoSlug?: string;
  /** Whether the video is published (pre-fetched server-side) */
  videoPublished?: boolean;
  /** Human-readable video title */
  videoTitleEn?: string;
  videoTitleVi?: string;
}

interface HelpTooltipProps {
  locale: string;
  content: HelpTooltipContent;
  /** Label shown near the "?" icon (e.g. page title for screen readers) */
  pageLabel?: string;
}

export function HelpTooltip({ locale, content, pageLabel }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const isVi = locale.startsWith("vi");
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Focus trap: focus first focusable on open
  useEffect(() => {
    if (open) {
      const el = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      el?.focus();
    }
  }, [open]);

  const intro = isVi ? content.introVi : content.introEn;
  const videoTitle = isVi ? content.videoTitleVi : content.videoTitleEn;
  const hasVideo = !!content.videoSlug;
  const isPublished = content.videoPublished === true;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-primary-300 hover:bg-primary-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
        aria-label={
          isVi
            ? `Trợ giúp cho ${pageLabel ?? "trang này"}`
            : `Help for ${pageLabel ?? "this page"}`
        }
        aria-haspopup="dialog"
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={isVi ? "Trợ giúp nhanh" : "Quick help"}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); triggerRef.current?.focus(); } }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-4"
          >
            {/* Close */}
            <button
              type="button"
              onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500"
              aria-label={isVi ? "Đóng" : "Close"}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 pr-8">
              <HelpCircle className="w-5 h-5 text-primary-400 shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground">
                {isVi ? "Hướng dẫn nhanh" : "Quick guide"}
              </h2>
            </div>

            {/* Intro text */}
            <p className="text-sm text-muted-foreground leading-relaxed">{intro}</p>

            {/* Video link */}
            {hasVideo && (
              <div className="rounded-xl border border-primary-800/40 bg-primary-950/20 p-4 flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <Play className="w-4 h-4 text-primary-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary-300 mb-1">
                    {isVi ? "Video hướng dẫn" : "Tutorial video"}
                  </p>
                  {videoTitle && (
                    <p className="text-xs text-muted-foreground mb-2 truncate">{videoTitle}</p>
                  )}
                  {isPublished ? (
                    <a
                      href={`/dashboard/help#video-${content.videoSlug}`}
                      className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      {isVi ? "Xem video" : "Watch video"}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {isVi ? "Video sắp ra mắt" : "Video coming soon"}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Footer link */}
            <Link
              href="/dashboard/help"
              className="block text-xs text-center text-muted-foreground hover:text-primary-400 transition-colors"
              onClick={() => setOpen(false)}
            >
              {isVi ? "Trung tâm trợ giúp" : "Help Center"}
              {" →"}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
