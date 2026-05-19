'use client';

/**
 * Handover Onboarding Banner
 * Shows at the top of customer dashboard after magic link first login.
 * Disappears once all onboarding steps complete or user dismisses.
 *
 * @module components/dashboard/handover-onboarding-banner
 */

import { useState, useEffect } from 'react';
import { X, ChevronRight, Loader2 } from 'lucide-react';

interface OnboardingData {
  handoverId: string;
  agencyName: string;
  tier: string;
  firstLoginAt: number | null;
  firstSopInstallAt: number | null;
  firstRunAt: number | null;
  status: string;
}

interface Props {
  userId: string;
  locale: string;
}

const DISMISS_KEY = 'sophia_onboarding_banner_dismissed';

export function HandoverOnboardingBanner({ userId, locale }: Props) {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const isVi = locale.startsWith('vi');

  useEffect(() => {
    const dismissedKey = `${DISMISS_KEY}_${userId}`;
    if (typeof window !== 'undefined' && localStorage.getItem(dismissedKey)) {
      setLoading(false);
      setDismissed(true);
      return;
    }

    void (async () => {
      try {
        const res = await fetch(`/api/admin/handover/customer-status`);
        if (res.ok) {
          const body = await res.json() as { handover: OnboardingData | null };
          if (body.handover) setData(body.handover);
        }
      } catch {
        // No handover data — banner stays hidden
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  function dismiss() {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${DISMISS_KEY}_${userId}`, '1');
    }
  }

  if (loading || dismissed || !data) return null;

  // All steps complete → don't show
  if (data.firstLoginAt && data.firstSopInstallAt && data.firstRunAt) return null;

  const totalSteps = 5;
  const completedSteps =
    1 + // account always done
    (data.firstLoginAt ? 1 : 0) +
    (data.firstSopInstallAt ? 1 : 0) +
    (data.firstRunAt ? 1 : 0);

  const progressPct = Math.round((completedSteps / totalSteps) * 100);
  const remaining = totalSteps - completedSteps;

  return (
    <div className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-900/20 to-blue-900/20 backdrop-blur-sm p-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-violet-300">
            {isVi ? 'Chào mừng đến Sophia!' : 'Welcome to Sophia!'}
          </span>
          <span className="text-xs text-zinc-500">
            {isVi ? `${remaining} bước còn lại` : `${remaining} steps remaining`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-zinc-400">
          {isVi
            ? 'Hoàn thành onboarding để bắt đầu tạo video tự động.'
            : 'Complete onboarding to start creating automated videos.'}
        </p>
      </div>

      <a
        href={`/${locale}/welcome`}
        className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors"
      >
        {isVi ? 'Xem hướng dẫn' : 'View Guide'}
        <ChevronRight size={14} />
      </a>

      <button
        onClick={dismiss}
        className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        aria-label={isVi ? 'Đóng' : 'Close'}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
