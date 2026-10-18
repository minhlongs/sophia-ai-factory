/**
 * Platform Badge and Approve Action Button for DraftApprovalCard.
 *
 * Layer: UI Component
 * @module components/social-publisher/draft-approval-card-parts
 */

'use client';

import React from 'react';
import type { StoredPublishJob } from '@/land/social/publish-job-store';
import { CheckCircle2, Loader2, Sparkles, Youtube, Video, Instagram } from 'lucide-react';

export function DraftPlatformBadge({ platform }: { platform: StoredPublishJob['platform'] }) {
  switch (platform) {
    case 'YOUTUBE_SHORTS':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center gap-1">
          <Youtube className="w-3 h-3" /> YouTube Shorts
        </span>
      );
    case 'TIKTOK_V2':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center gap-1">
          <Video className="w-3 h-3" /> TikTok v2
        </span>
      );
    case 'INSTAGRAM_REELS':
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center gap-1">
          <Instagram className="w-3 h-3" /> Reels
        </span>
      );
    default:
      return null;
  }
}

export function DraftApproveButton({
  approving,
  approved,
  onClick,
}: {
  approving: boolean;
  approved: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={approving || approved}
      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all ${
        approved
          ? 'bg-[#10B981] text-white cursor-default'
          : 'bg-[#4F46E5] hover:bg-[#4338CA] text-white disabled:opacity-50'
      }`}
    >
      {approving ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Đang duyệt...</span>
        </>
      ) : approved ? (
        <>
          <CheckCircle2 className="w-3 h-3" />
          <span>Đã duyệt (Pending)</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3 h-3 text-[#F59E0B]" />
          <span>1-Click Duyệt</span>
        </>
      )}
    </button>
  );
}
