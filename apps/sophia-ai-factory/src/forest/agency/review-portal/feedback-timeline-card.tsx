/**
 * Feedback Timeline & Comment Submission Card Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/feedback-timeline-card
 */

import React from 'react';
import { MessageSquare, Sparkles, Play } from 'lucide-react';
import type { FeedbackComment } from '@/seed/types/agency-multitenancy';
import { formatTime } from './types';
import { FeedbackCommentForm } from './feedback-comment-form';

interface FeedbackTimelineCardProps {
  comments: FeedbackComment[];
  isVi: boolean;
  isExpired?: boolean;
  authorName: string;
  setAuthorName: (val: string) => void;
  commentText: string;
  setCommentText: (val: string) => void;
  pinTimestamp: boolean;
  setPinTimestamp: (val: boolean) => void;
  currentTimeSec: number;
  isSubmittingComment: boolean;
  onSeekTo: (seconds?: number) => void;
  onAddComment: (e: React.FormEvent) => void;
}

export function FeedbackTimelineCard({
  comments,
  isVi,
  isExpired,
  authorName,
  setAuthorName,
  commentText,
  setCommentText,
  pinTimestamp,
  setPinTimestamp,
  currentTimeSec,
  isSubmittingComment,
  onSeekTo,
  onAddComment,
}: FeedbackTimelineCardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 flex flex-col h-full shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white">
            {isVi ? 'Ý kiến & Góp ý chỉnh sửa' : 'Feedback & Revision Notes'}
          </h2>
        </div>
        <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded-full">
          {comments.length}
        </span>
      </div>

      {/* Comments Timeline */}
      <div className="flex-1 overflow-y-auto max-h-[380px] my-3 space-y-3 pr-1">
        {comments.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs">
            <Sparkles className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="font-medium">
              {isVi ? 'Chưa có bình luận nào.' : 'No feedback comments yet.'}
            </p>
            <p className="text-slate-600 mt-1">
              {isVi ? 'Góp ý của bạn sẽ xuất hiện tại đây.' : 'Your notes will appear here.'}
            </p>
          </div>
        ) : (
          comments.map((c, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-slate-800/80 bg-slate-800/30 space-y-1.5 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">{c.author}</span>
                {typeof c.timestampSec === 'number' && (
                  <button
                    type="button"
                    onClick={() => onSeekTo(c.timestampSec)}
                    className="text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1"
                    title={isVi ? 'Nhấp để nhảy đến giây này' : 'Click to jump to timestamp'}
                  >
                    <Play className="w-2.5 h-2.5" />
                    {formatTime(c.timestampSec)}
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{c.comment}</p>
              <span className="text-[10px] text-slate-500 block">
                {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Add Comment Form */}
      {!isExpired && (
        <FeedbackCommentForm
          isVi={isVi}
          authorName={authorName}
          setAuthorName={setAuthorName}
          commentText={commentText}
          setCommentText={setCommentText}
          pinTimestamp={pinTimestamp}
          setPinTimestamp={setPinTimestamp}
          currentTimeSec={currentTimeSec}
          isSubmittingComment={isSubmittingComment}
          onAddComment={onAddComment}
        />
      )}
    </div>
  );
}
