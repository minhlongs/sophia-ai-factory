'use client';

/**
 * Creator Template Card Main View Component
 *
 * Layer: land
 *
 * @module land/marketplace/template-card/creator-template-card-view
 */

import React, { useState, useTransition } from 'react';
import { activateTemplate, submitReview } from '@/land/marketplace/marketplace-actions';
import type { CreatorTemplateCardProps, CardStatusMessage } from './types';
import { CardMediaPreview } from './card-media-preview';
import { CardPricingBadge } from './card-pricing-badge';
import { CardReviewModal } from './card-review-modal';

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
  const creatorShareUsd = (Math.floor(template.price_cents * 0.70) / 100).toFixed(2);
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

      {showReviewModal && (
        <CardReviewModal
          templateTitle={template.title}
          reviewRating={reviewRating}
          reviewText={reviewText}
          isReviewPending={isReviewPending}
          onRatingChange={setReviewRating}
          onTextChange={setReviewText}
          onClose={() => setShowReviewModal(false)}
          onSubmit={handleSubmitReview}
        />
      )}
    </div>
  );
}
