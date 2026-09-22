'use client';

/**
 * Interactive Client Video Review & Approval Portal
 *
 * Provides a responsive, bilingual (VI/EN) interface for agency clients:
 * - HTML5 video draft player with timestamp syncing
 * - Whitelabel client branding (logo, primary & accent color palette)
 * - Timeline feedback comment list with timestamp jumps
 * - Approve Video & Request Changes workflow with automated publish hook
 *
 * Layer: forest/agency (UI components & presentation)
 *
 * @module forest/agency/client-video-review-portal
 */

import React, { useState, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  MessageSquare,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type { VideoReviewPayload, FeedbackComment } from '@/seed/types/agency-multitenancy';

export interface ClientVideoReviewPortalProps {
  review: VideoReviewPayload;
  locale?: 'en' | 'vi';
  onFeedbackSubmit?: (comment: FeedbackComment) => Promise<void>;
  onDecisionSubmit?: (decision: 'approve' | 'request_changes', note?: string) => Promise<void>;
}

function formatTime(seconds?: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ClientVideoReviewPortal({
  review: initialReview,
  locale: initialLocale = 'vi',
  onFeedbackSubmit,
  onDecisionSubmit,
}: ClientVideoReviewPortalProps) {
  const [locale, setLocale] = useState<'en' | 'vi'>(initialLocale);
  const isVi = locale === 'vi';

  const [review, setReview] = useState<VideoReviewPayload>(initialReview);
  const [comments, setComments] = useState<FeedbackComment[]>(initialReview.feedbackComments || []);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [authorName, setAuthorName] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [pinTimestamp, setPinTimestamp] = useState<boolean>(true);
  const [decisionNote, setDecisionNote] = useState<string>('');
  const [activeModal, setActiveModal] = useState<'approve' | 'request_changes' | null>(null);

  const [isSubmittingComment, setIsSubmittingComment] = useState<boolean>(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const branding = review.subaccountBranding;
  const primaryColor = branding?.primaryColor || '#0f172a';
  const accentColor = branding?.accentColor || '#10b981';

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTimeSec(Math.floor(videoRef.current.currentTime));
    }
  };

  const seekTo = (seconds?: number) => {
    if (typeof seconds === 'number' && videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    setErrorMessage(null);
    setFeedbackSuccess(null);

    const newComment: FeedbackComment = {
      author: authorName.trim() || (isVi ? 'Khách hàng' : 'Client Reviewer'),
      comment: commentText.trim(),
      timestampSec: pinTimestamp ? currentTimeSec : undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      if (onFeedbackSubmit) {
        await onFeedbackSubmit(newComment);
      } else {
        const res = await fetch(`/api/client-review/${review.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'comment',
            comment: newComment.comment,
            author: newComment.author,
            timestampSec: newComment.timestampSec,
          }),
        });
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || 'Failed to submit comment');
        }
      }

      setComments((prev) => [...prev, newComment]);
      setCommentText('');
      setFeedbackSuccess(
        isVi ? 'Đã gửi góp ý thành công!' : 'Feedback submitted successfully!'
      );
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDecision = async (decision: 'approve' | 'request_changes') => {
    setIsSubmittingDecision(true);
    setErrorMessage(null);

    try {
      if (onDecisionSubmit) {
        await onDecisionSubmit(decision, decisionNote.trim());
      } else {
        const res = await fetch(`/api/client-review/${review.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'decision',
            decision,
            feedbackNote: decisionNote.trim(),
            author: authorName.trim() || (decision === 'approve' ? 'Client Approver' : 'Client Reviewer'),
          }),
        });
        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(errData.error || 'Failed to submit review decision');
        }
      }

      const nextStatus = decision === 'approve' ? 'APPROVED' : 'CHANGES_REQUESTED';
      setReview((prev) => ({ ...prev, status: nextStatus }));
      if (decisionNote.trim()) {
        setComments((prev) => [
          ...prev,
          {
            author: authorName.trim() || (decision === 'approve' ? 'Client Approver' : 'Client Reviewer'),
            comment: decisionNote.trim(),
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      setActiveModal(null);
      setDecisionNote('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const isPending = review.status === 'PENDING';
  const isApproved = review.status === 'APPROVED';
  const isChangesRequested = review.status === 'CHANGES_REQUESTED';
  const isExpired = review.isExpired;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased font-sans pb-16">
      {/* Whitelabel Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.clientName || 'Client Brand'}
                className="h-8 sm:h-9 object-contain max-w-[140px]"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-white shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                {branding?.clientName?.slice(0, 2).toUpperCase() || 'SA'}
              </div>
            )}
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                {branding?.clientName || (isVi ? 'Cổng Duyệt Video Khách Hàng' : 'Client Review Portal')}
              </h1>
              <p className="text-xs text-slate-400">
                {isVi ? 'Không gian duyệt sản phẩm truyền thông' : 'Media Draft Review & Approval'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(isVi ? 'en' : 'vi')}
              className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition"
              title={isVi ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese'}
            >
              {isVi ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'}
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sophia Verified Secure</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Status Notification Banner */}
        {isExpired ? (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/40 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-red-300">
                {isVi ? 'Liên kết phê duyệt đã hết hạn' : 'Review Link Expired'}
              </h2>
              <p className="text-xs text-red-400/90 mt-0.5">
                {isVi
                  ? 'Liên kết này đã vượt quá thời hạn 7 ngày bảo mật. Vui lòng liên hệ Agency để được cấp liên kết mới.'
                  : 'This review link has exceeded its 7-day security window. Please contact your agency for a renewed link.'}
              </p>
            </div>
          </div>
        ) : isApproved ? (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-emerald-300">
                {isVi ? 'Bản nháp video đã được Phê duyệt' : 'Video Draft Approved'}
              </h2>
              <p className="text-xs text-emerald-400/90 mt-0.5">
                {isVi
                  ? 'Video đã được xác nhận sẵn sàng và tự động kích hoạt tiến trình xuất bản đa kênh.'
                  : 'Video has been verified and automatically queued for multi-channel automated distribution.'}
              </p>
            </div>
          </div>
        ) : isChangesRequested ? (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/40 flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-amber-300">
                {isVi ? 'Đã yêu cầu chỉnh sửa' : 'Revisions Requested'}
              </h2>
              <p className="text-xs text-amber-400/90 mt-0.5">
                {isVi
                  ? 'Đội ngũ sản xuất video đang tiếp nhận phản hồi và chuẩn bị phiên bản cập nhật.'
                  : 'The video editing team has received your feedback notes and is preparing an updated cut.'}
              </p>
            </div>
          </div>
        ) : null}

        {/* Action Error/Success Alerts */}
        {errorMessage && (
          <div className="p-3 rounded-lg border border-red-500/40 bg-red-950/60 text-xs text-red-200 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
          </div>
        )}
        {feedbackSuccess && (
          <div className="p-3 rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-xs text-emerald-200">
            {feedbackSuccess}
          </div>
        )}

        {/* 2-Column Grid: Left (Player & Details), Right (Feedback & Actions) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Video Player & Info */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-2xl">
              <div className="relative aspect-video bg-black flex items-center justify-center">
                {review.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={review.videoUrl}
                    controls
                    onTimeUpdate={handleTimeUpdate}
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

            {/* Quick Action Decision Cards on Mobile/Tablet */}
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
                    onClick={() => setActiveModal('request_changes')}
                    className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {isVi ? 'Yêu cầu chỉnh sửa' : 'Request Changes'}
                  </button>
                  <button
                    onClick={() => setActiveModal('approve')}
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

          {/* Right Column (4 cols): Feedback Timeline & Comment Input */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-4">
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
                            onClick={() => seekTo(c.timestampSec)}
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
                <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-800 space-y-3">
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
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Decision Modal: Approve */}
      {activeModal === 'approve' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isVi ? 'Xác nhận Phê duyệt Video' : 'Confirm Video Approval'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isVi ? 'Video sẽ được chuyển sang trạng thái sẵn sàng xuất bản.' : 'The video will be scheduled for distribution.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {isVi ? 'Lời nhắn phê duyệt (tùy chọn):' : 'Approval note (optional):'}
              </label>
              <textarea
                rows={3}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={isVi ? 'VD: Video rất đẹp, đồng ý đăng tải!' : 'e.g. Looks great, ready to publish!'}
                className="w-full text-xs rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingDecision}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                {isVi ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleDecision('approve')}
                disabled={isSubmittingDecision}
                className="px-5 py-2 text-xs font-semibold rounded-lg text-white shadow-lg transition flex items-center gap-2"
                style={{ backgroundColor: accentColor }}
              >
                <Check className="w-4 h-4" />
                {isSubmittingDecision
                  ? (isVi ? 'Đang xử lý...' : 'Processing...')
                  : (isVi ? 'Xác nhận Duyệt' : 'Confirm Approval')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Modal: Request Changes */}
      {activeModal === 'request_changes' && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {isVi ? 'Yêu cầu chỉnh sửa bản nháp' : 'Request Video Revision'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isVi ? 'Gửi ghi chú yêu cầu thay đổi tới nhóm biên tập viên.' : 'Send feedback to the video editor team.'}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {isVi ? 'Nội dung cần chỉnh sửa (bắt buộc):' : 'Revision notes (required):'}
              </label>
              <textarea
                rows={4}
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={isVi ? 'Mô tả chi tiết những điểm cần đổi (font chữ, đoạn cắt, nhạc nền...)' : 'Describe details to modify (cuts, audio, typography...)'}
                className="w-full text-xs rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                disabled={isSubmittingDecision}
                className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
              >
                {isVi ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleDecision('request_changes')}
                disabled={isSubmittingDecision || !decisionNote.trim()}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition disabled:opacity-50 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {isSubmittingDecision
                  ? (isVi ? 'Đang gửi...' : 'Sending...')
                  : (isVi ? 'Gửi yêu cầu sửa' : 'Submit Revisions')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
