'use client';

/**
 * Creator Template Card Review Modal Component
 *
 * Layer: land
 * @module land/marketplace/template-card/card-review-modal
 */

import React from 'react';
import { Star } from 'lucide-react';

export interface CardReviewModalProps {
  templateTitle: string;
  reviewRating: number;
  reviewText: string;
  isReviewPending: boolean;
  onRatingChange: (rating: number) => void;
  onTextChange: (text: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function CardReviewModal({
  templateTitle,
  reviewRating,
  reviewText,
  isReviewPending,
  onRatingChange,
  onTextChange,
  onClose,
  onSubmit,
}: CardReviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#181924] p-6 shadow-2xl">
        <h4 className="text-base font-bold text-foreground">Review: {templateTitle}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Rate your experience using this video blueprint.
        </p>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Rating: {reviewRating} / 5 Stars
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => onRatingChange(star)}
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
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Share conversion tips or hook remix advice..."
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-black/30 p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
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
  );
}
