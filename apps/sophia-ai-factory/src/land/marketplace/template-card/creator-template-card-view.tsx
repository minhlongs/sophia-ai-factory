'use client';

/**
 * Creator Template Card Main View Component
 *
 * Layer: land
 *
 * @module land/marketplace/template-card/creator-template-card-view
 */

import React, { useState, useTransition } from 'react';
import { Star } from 'lucide-react';
import { activateTemplate, submitReview } from '@/land/marketplace/marketplace-actions';
import type { CreatorTemplateCardProps, CardStatusMessage } from './types';
import { CardMediaPreview } from './card-media-preview';
import { CardPricingBadge } from './card-pricing-badge';

export function CreatorTemplateCardView({
  template,
  currentUserId,
  onActivated,
}: CreatorTemplateCardProps) {
  const [isPending, startTransition] = useTransition();
  const [statusMsg, setStatusMsg] = useState<CardStatusMessage | null>(null);
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
      <CardMediaPreview template={template} />

      <CardPricingBadge
        priceUsd={priceUsd}
        creatorShareUsd={creatorShareUsd}
        isOwner={isOwner}
        isPending={isPending}
        statusMsg={statusMsg}
        onOpenReviewModal={() => setShowReviewModal(true)}
        onActivate={handleActivate}
      />

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
