"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Zap, Video } from "lucide-react";
import { useTranslations } from "next-intl";

type BannerVariant = "raas" | "video" | null;

interface CrossSellBannerProps {
  /** Pass "raas" if user has never used RaaS (show video→proposals CTA) */
  /** Pass "video" if user has never created campaigns (show proposals→video CTA) */
  variant: BannerVariant;
}

const DISMISS_KEY_RAAS = "sophia_crosssell_raas_dismissed";
const DISMISS_KEY_VIDEO = "sophia_crosssell_video_dismissed";

export function CrossSellBanner({ variant }: CrossSellBannerProps) {
  const t = useTranslations("dashboard.crossSell");
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid hydration flash

  useEffect(() => {
    if (!variant) return;
    const key = variant === "raas" ? DISMISS_KEY_RAAS : DISMISS_KEY_VIDEO;
    const isDismissed = localStorage.getItem(key) === "1";
    setDismissed(isDismissed);
  }, [variant]);

  function handleDismiss() {
    if (!variant) return;
    const key = variant === "raas" ? DISMISS_KEY_RAAS : DISMISS_KEY_VIDEO;
    localStorage.setItem(key, "1");
    setDismissed(true);
  }

  if (!variant || dismissed) return null;

  const isRaasBanner = variant === "raas";

  return (
    <div
      className={`relative rounded-xl border p-4 flex items-center gap-4 ${
        isRaasBanner
          ? "border-primary/30 bg-gradient-to-r from-primary/10 to-purple-500/5"
          : "border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-cyan-500/5"
      }`}
    >
      {/* Icon */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          isRaasBanner ? "bg-primary/20 text-primary" : "bg-blue-500/20 text-blue-400"
        }`}
      >
        {isRaasBanner ? <Zap className="w-5 h-5" aria-hidden="true" /> : <Video className="w-5 h-5" aria-hidden="true" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {isRaasBanner ? t("raas_title") : t("video_title")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isRaasBanner ? t("raas_desc") : t("video_desc")}
        </p>
      </div>

      {/* CTA */}
      <Link
        href={isRaasBanner ? "/dashboard/proposals" : "/dashboard/create"}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          isRaasBanner
            ? "bg-primary hover:bg-primary/80 text-white"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {isRaasBanner ? t("raas_cta") : t("video_cta")}
      </Link>

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t("dismiss")}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
