"use client";

/**
 * Free trial countdown banner shown on dashboard for users with active trials.
 * Auto-hides when trial_ends_at has passed. Shows urgency 1 day before expiry.
 */

import { useMemo } from "react";
import Link from "next/link";

interface TrialBannerProps {
  /** Unix timestamp (seconds) when trial ends */
  trialEndsAt: number;
  locale: string;
}

export function TrialBanner({ trialEndsAt, locale }: TrialBannerProps) {
  const isVi = locale.startsWith("vi");
  const nowSec = Math.floor(Date.now() / 1000);

  const daysLeft = useMemo(() => {
    const diff = trialEndsAt - nowSec;
    if (diff <= 0) return 0;
    return Math.ceil(diff / 86400);
  }, [trialEndsAt, nowSec]);

  if (daysLeft <= 0) return null;

  const isUrgent = daysLeft <= 1;

  const text = isUrgent
    ? isVi
      ? "Trial của bạn hết hạn vào ngày mai! Nâng cấp ngay để giữ tính năng →"
      : "Your trial expires tomorrow! Upgrade now to keep access →"
    : isVi
      ? `Dùng thử miễn phí: còn ${daysLeft} ngày. Nâng cấp để giữ tính năng →`
      : `Free trial: ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining. Upgrade to keep features →`;

  return (
    <div
      className={`w-full px-4 py-2.5 text-center text-sm font-medium transition-colors ${
        isUrgent
          ? "bg-gradient-to-r from-amber-600/80 to-orange-600/80 text-white"
          : "bg-gradient-to-r from-emerald-600/70 to-violet-600/70 text-white"
      }`}
    >
      <Link
        href={`/${locale}/pricing`}
        className="inline-flex items-center gap-2 hover:underline"
      >
        {isUrgent && <span>⚠️</span>}
        {!isUrgent && <span>⏳</span>}
        {text}
      </Link>
    </div>
  );
}
