/**
 * Video Player & Metadata Card Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/video-player-card
 */

import React from 'react';
import { Play, Clock, RotateCcw, Check } from 'lucide-react';
import type { VideoReviewPayload } from '@/seed/types/agency-multitenancy';
import { formatTime, type ReviewDecisionType } from './types';

interface VideoPlayerCardProps {
  review: VideoReviewPayload;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTimeSec: number;
  accentColor: string;
  isVi: boolean;
  isExpired?: boolean;
  onTimeUpdate: () => void;
  onOpenModal: (type: ReviewDecisionType) => void;
}

export function VideoPlayerCard({
  review,
  videoRef,
  currentTimeSec,
  accentColor,
  isVi,
  isExpired,
  onTimeUpdate,
  onOpenModal,
}: VideoPlayerCardProps) {
  const isApproved = review.status === 'APPROVED';
  const isChangesRequested = review.status === 'CHANGES_REQUESTED';
  const isPending = review.status === 'PENDING';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
        <div className="relative aspect-video bg-black flex items-center justify-center">
          {review.videoUrl ? (
            <video
              ref={videoRef}
              src={review.videoUrl}
              controls
              onTimeUpdate={onTimeUpdate}
              className="w-full h-full object-contain"
              preload="metadata"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 p-8 text-center">
              <Play className="w-12 h-12 mb-2 text-slate-600" />
              <p className="text-sm font-medium">
                {isVi ? 'Đang chuẩn bị luồng hiển thị video...' : 'Video preview stream preparing...'}
              </p>
            </div>
          )}
        </div>

        {/* Video Title & Metadata Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {review.videoTitle || (isVi ? 'Bản thảo video truyền thông' : 'Draft Campaign Video')}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>ID: {review.videoId.slice(0, 10)}...</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {isVi ? 'Vị trí hiện tại:' : 'Current position:'}{' '}
                <span className="font-mono text-emerald-400 font-semibold">{formatTime(currentTimeSec)}</span>
              </span>
            </div>
          </div>

          <span
            className={`px-3 py-1 text-xs font-semibold rounded-full border ${
              isApproved
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : isChangesRequested
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-blue-500/40 bg-blue-500/10 text-blue-300'
            }`}
          >
            {isApproved
              ? (isVi ? 'ĐÃ DUYỆT' : 'APPROVED')
              : isChangesRequested
                ? (isVi ? 'YÊU CẦU SỬA' : 'REVISIONS')
                : (isVi ? 'CHỜ PHÊ DUYỆT' : 'PENDING REVIEW')}
          </span>
        </div>
      </div>

      {/* Quick Action Decision Cards */}
      {!isExpired && isPending && (
        <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white">
              {isVi ? 'Quyết định phê duyệt bản thảo' : 'Draft Approval Decision'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isVi
                ? 'Bấm Phê duyệt để tự động phân phối, hoặc Yêu cầu chỉnh sửa kèm góp ý.'
                : 'Approve to trigger distribution or request revision with notes.'}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => onOpenModal('request_changes')}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isVi ? 'Yêu cầu chỉnh sửa' : 'Request Changes'}
            </button>
            <button
              onClick={() => onOpenModal('approve')}
              className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold rounded-xl text-white shadow-lg transition flex items-center justify-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <Check className="w-4 h-4" />
              {isVi ? 'Phê duyệt Video' : 'Approve Video'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
