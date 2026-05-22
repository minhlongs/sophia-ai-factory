'use client';

/**
 * CommunityListingCard — displays a single community SOP listing with buy/purchased state.
 * Client component because it handles click → server action dispatch.
 */

import { useState, useTransition } from 'react';
import { ShoppingCart, CheckCircle, User } from 'lucide-react';
import { purchaseSopAction } from './actions';

type ListingWithTemplate = {
  id: string;
  template_id: string;
  price_cents: number;
  total_sales: number;
  author_user_id: string | null;
  name_en: string;
  name_vi: string;
};

interface CommunityListingCardProps {
  listing: ListingWithTemplate;
  isPurchased: boolean;
  locale: string;
  buyLabel: string;
  purchasedLabel: string;
  byLabel: string;
}

export function CommunityListingCard({
  listing,
  isPurchased,
  locale,
  buyLabel,
  purchasedLabel,
  byLabel,
}: CommunityListingCardProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(isPurchased);

  const isVi = locale.startsWith('vi');
  const displayName = isVi ? listing.name_vi : listing.name_en;
  const priceUsd = (listing.price_cents / 100).toFixed(2);
  // Show shortened author ID as creator identifier (no PII leak)
  const creatorLabel = listing.author_user_id
    ? `${byLabel} #${listing.author_user_id.slice(0, 6)}`
    : null;

  function handleBuy() {
    setError(null);
    startTransition(async () => {
      const result = await purchaseSopAction(listing.template_id);
      if (result.error) {
        setError(result.error);
      } else {
        setPurchased(true);
      }
    });
  }

  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-4 flex flex-col gap-3 hover:border-violet-500/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-100 leading-snug">{displayName}</h3>
        <span className="shrink-0 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full">
          ${priceUsd}
        </span>
      </div>

      <div className="flex items-center gap-1 text-xs text-zinc-500">
        {creatorLabel && (
          <>
            <User className="w-3 h-3" aria-hidden="true" />
            <span>{creatorLabel}</span>
          </>
        )}
        {listing.total_sales > 0 && (
          <span className="ml-auto text-zinc-600">{listing.total_sales} sales</span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}

      {purchased ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mt-auto">
          <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
          {purchasedLabel}
        </div>
      ) : (
        <button
          onClick={handleBuy}
          disabled={pending}
          className="mt-auto flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-semibold text-white transition-colors"
        >
          <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
          {pending ? '...' : `${buyLabel} $${priceUsd}`}
        </button>
      )}
    </div>
  );
}
