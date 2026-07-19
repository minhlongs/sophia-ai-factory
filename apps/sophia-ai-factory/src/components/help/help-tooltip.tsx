"use client";

/**
 * help-tooltip.tsx
 * "?" icon that opens a modal with route-specific intro text + optional video link.
 * All user-facing strings use useTranslations('help').
 */

import { useState, useEffect, useRef } from "react";
import { Link } from '@/seed/navigation';
import { HelpCircle, X, Play, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";

export interface HelpTooltipContent {
  introEn: string;
  introVi: string;
  videoSlug?: string;
  videoPublished?: boolean;
  videoTitleEn?: string;
  videoTitleVi?: string;
}

interface HelpTooltipProps {
  locale: string;
  content: HelpTooltipContent;
  pageLabel?: string;
}

export function HelpTooltip({ locale, content, pageLabel }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("help");
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const el = modalRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      el?.focus();
    }
  }, [open]);

  const intro = locale.startsWith("vi") ? content.introVi : content.introEn;
  const videoTitle = locale.startsWith("vi") ? content.videoTitleVi : content.videoTitleEn;
  const hasVideo = !!content.videoSlug;
  const isPublished = content.videoPublished === true;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-muted-foreground hover:text-primary-300 hover:bg-primary-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={t("aria_trigger", { label: pageLabel ?? t("aria_trigger_default") })}
        aria-haspopup="dialog"
      >
        <HelpCircle className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("dialog_label")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setOpen(false); triggerRef.current?.focus(); } }}
        >
          <div
            ref={modalRef}
            className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-4"
          >
            <button
              type="button"
              onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={t("close")}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 pr-8">
              <HelpCircle className="w-5 h-5 text-primary-400 shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground">{t("header")}</h2>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{intro}</p>

            {hasVideo && (
              <div className="rounded-xl border border-primary-800/40 bg-primary-950/20 p-4 flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <Play className="w-4 h-4 text-primary-400" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary-300 mb-1">{t("tutorial_video")}</p>
                  {videoTitle && <p className="text-xs text-muted-foreground mb-2 truncate">{videoTitle}</p>}
                  {isPublished ? (
                    <a
                      href={`/dashboard/help#video-${content.videoSlug}`}
                      className="inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 hover:underline"
                      onClick={() => setOpen(false)}
                    >
                      {t("watch_video")}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t("video_coming_soon")}</span>
                  )}
                </div>
              </div>
            )}

            <Link
              href="/dashboard/help"
              className="block text-xs text-center text-muted-foreground hover:text-primary-400 transition-colors"
              onClick={() => setOpen(false)}
            >
              {t("help_center")} {" →"}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
