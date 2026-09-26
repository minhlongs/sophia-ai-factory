'use client';

/**
 * Creator Template Card Component
 *
 * Layer: land (pure UI component)
 *
 * Displays a creator-submitted video template with 70/30 royalty split,
 * quality virality score badge, star rating, and 1-click activation.
 *
 * @module land/marketplace/creator-template-card
 */

import React, { useState, useTransition } from 'react';
import {
  Sparkles,
  Star,
  Coins,
  Play,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import type { CreatorTemplateItem } from '@/tree/marketplace/types';
import { activateTemplate, submitReview } from '@/land/marketplace/marketplace-actions';

export interface CreatorTemplateCardProps {
  template: CreatorTemplateItem;
  currentUserId?: string;
  onActivated?: () => void;
}

export function CreatorTemplateCard({
  template,
  currentUserId,
  onActivated,
}: CreatorTemplateCardProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isReviewPending, setIsReviewPending] = useState(false);

  const priceUsd = (template.price_cents / 100).toFixed(2);
  const creatorShareUsd = ((Math.floor(template.price_cents * 0.70)) / 100).toFixed(2);
  const isOwner = currentUserId && currentUserId === template.creator_id;

  const handleActivate = () => {
    setStatusMsg(null);
    startTransition(async () => {
      const res = await activateTemplate({ templateId: template.id });
      if (res.success && res.data) {
        setStatusMsg({
          type: 'success',
          text: `Activated! $${(res.data.activationResult.creatorCents / 100).toFixed(2)} allocated to creator.`,
        });
        if (onActivated) onActivated();
      } else {
        setStatusMsg({
          type: 'error',
          text: res.error || 'Failed to activate template',
        });
      }
    });
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReviewPending(true);
    setStatusMsg(null);
    try {
      const res = await submitReview({
        templateId: template.id,
        rating: reviewRating,
        reviewText,
      });
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Review submitted successfully!' });
        setShowReviewModal(false);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Failed to submit review' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: String(err) });
    } finally {
      setIsReviewPending(false);
    }
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#12131A]/90 p-5 shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-indigo-500/10">
      {/* Header tags */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-400 uppercase tracking-wide">
            {template.niche}
          </span>
          <div className="flex items-center gap-1.5">
            {template.quality_score >= 75 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                <Sparkles className="h-3 w-3" />
                Score {Math.round(template.quality_score)}
              </span>
            )}
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
              {template.target_platform.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Title & Hook */}
        <div className="mt-3 space-y-1">
          <h3 className="text-base font-bold text-foreground line-clamp-1 group-hover:text-indigo-300 transition">
            {template.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-2 italic">
            &ldquo;{template.script_template.slice(0, 100)}...&rdquo;
          </p>
        </div>

        {/* Ratings & Usage Velocity */}
        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1 text-amber-400">
            <Star className="h-3.5 w-3.5 fill-amber-400" />
            <span className="font-semibold">{template.rating > 0 ? template.rating.toFixed(1) : 'New'}</span>
            <span className="text-muted-foreground text-[11px]">({template.review_count})</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Play className="h-3.5 w-3.5 text-indigo-400" />
              <span>{template.use_count} uses</span>
            </div>
            {template.trendingScore !== undefined && template.trendingScore > 0 && (
              <div className="flex items-center gap-1 text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>{template.trendingScore.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Price, 70/30 share, and Activate Button */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-foreground">${priceUsd}</span>
              <span className="text-[11px] text-muted-foreground">USD</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
              <Coins className="h-3 w-3" />
              <span>Creator earns 70% (${creatorShareUsd})</span>
            </div>
          </div>

          <button
            onClick={() => setShowReviewModal(true)}
            className="text-xs text-muted-foreground hover:text-foreground underline transition"
          >
            Review
          </button>
        </div>

        {statusMsg && (
          <div
            className={`mb-3 rounded-lg p-2 text-xs flex items-center gap-1.5 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span className="truncate">{statusMsg.text}</span>
          </div>
        )}

        <button
          onClick={handleActivate}
          disabled={isPending || Boolean(isOwner)}
          title={isOwner ? 'Self-activation prohibited for template creators' : 'Activate blueprint for remixing'}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? (
            'Activating...'
          ) : isOwner ? (
            'Your Template (Self-activation blocked)'
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Activate Blueprint (${priceUsd})
            </>
          )}
        </button>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#181924] p-6 shadow-2xl">
            <h4 className="text-base font-bold text-foreground">Review: {template.title}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Rate your experience using this video blueprint.
            </p>

            <form onSubmit={handleSubmitReview} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Rating: {reviewRating} / 5 Stars
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className="p-1 text-amber-400 hover:scale-110 transition"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= reviewRating ? 'fill-amber-400' : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Comments (Optional)
                </label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Share conversion tips or hook remix advice..."
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReviewPending}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {isReviewPending ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
