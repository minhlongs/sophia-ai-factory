/**
 * Feedback Comment Submission Form Sub-Component
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/review-portal/feedback-comment-form
 */

import React from 'react';
import { Clock, Send } from 'lucide-react';
import { formatTime } from './types';

export interface FeedbackCommentFormProps {
  isVi: boolean;
  authorName: string;
  setAuthorName: (val: string) => void;
  commentText: string;
  setCommentText: (val: string) => void;
  pinTimestamp: boolean;
  setPinTimestamp: (val: boolean) => void;
  currentTimeSec: number;
  isSubmittingComment: boolean;
  onAddComment: (e: React.FormEvent) => void;
}

export function FeedbackCommentForm({
  isVi,
  authorName,
  setAuthorName,
  commentText,
  setCommentText,
  pinTimestamp,
  setPinTimestamp,
  currentTimeSec,
  isSubmittingComment,
  onAddComment,
}: FeedbackCommentFormProps) {
  return (
    <form onSubmit={onAddComment} className="pt-3 border-t border-slate-800 space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={isVi ? 'Tên của bạn...' : 'Your name...'}
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="w-full text-xs rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={() => setPinTimestamp(!pinTimestamp)}
          className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono whitespace-nowrap transition flex items-center gap-1 ${
            pinTimestamp
              ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
              : 'border-slate-700 bg-slate-800 text-slate-400'
          }`}
          title={isVi ? 'Ghim tại mốc thời gian hiện tại' : 'Pin to current playback time'}
        >
          <Clock className="w-3 h-3" />
          {pinTimestamp ? formatTime(currentTimeSec) : '--:--'}
        </button>
      </div>

      <textarea
        rows={2}
        placeholder={
          isVi
            ? 'Nhập góp ý hoặc ghi chú cần chỉnh sửa...'
            : 'Type feedback or revision note...'
        }
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        className="w-full text-xs rounded-lg border border-slate-700 bg-slate-800/80 p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
      />

      <button
        type="submit"
        disabled={isSubmittingComment || !commentText.trim()}
        className="w-full py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Send className="w-3.5 h-3.5" />
        {isSubmittingComment
          ? (isVi ? 'Đang gửi...' : 'Sending...')
          : (isVi ? 'Gửi góp ý' : 'Submit Feedback')}
      </button>
    </form>
  );
}
