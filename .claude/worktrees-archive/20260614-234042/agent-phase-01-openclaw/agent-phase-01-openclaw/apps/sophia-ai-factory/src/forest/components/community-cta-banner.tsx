"use client";

/**
 * Dismissible community join CTA banner shown at top of dashboard content area.
 * Persists dismissed state in localStorage under key `community_cta_dismissed`.
 * Uses next-intl `community` namespace for all UI strings.
 */

import { useState, useEffect } from "react";
import { MessageCircle, Hash, X } from "lucide-react";
import { useTranslations } from "next-intl";

const DISMISSED_KEY = "community_cta_dismissed";

const TELEGRAM_URL = "https://t.me/sophia_ai_vn";
const DISCORD_URL = "https://discord.gg/sophia-ai";

export function CommunityCTABanner() {
  const t = useTranslations("community");
  // Tri-state: null = not yet read from localStorage (avoids flash)
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      setVisible(dismissed !== "1");
    } catch {
      // localStorage unavailable (SSR guard / private browsing) — show banner
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore write failure
    }
    setVisible(false);
  }

  // Render nothing until localStorage is read (prevents hydration mismatch)
  if (visible !== true) return null;

  return (
    <div
      role="banner"
      aria-label={t("joinCommunity")}
      className="relative w-full flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-violet-600/20 via-indigo-600/15 to-violet-600/20 border-b border-white/10 text-white"
    >
      {/* Left: label */}
      <p className="text-sm font-semibold shrink-0">{t("joinCommunity")}</p>

      {/* Centre: links */}
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium whitespace-nowrap"
          aria-label={t("telegramDescription")}
        >
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t("joinTelegram")}
        </a>

        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium whitespace-nowrap"
          aria-label={t("discordDescription")}
        >
          <Hash className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t("joinDiscord")}
        </a>
      </div>

      {/* Right: dismiss */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 sm:static sm:translate-y-0 p-1 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white"
        aria-label={t("dismiss")}
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
