'use client';

/**
 * Pricing Cards — 4 RaaS tiers for Sophia AI Factory.
 * Derives from PRICING_TIERS (single source of truth from POLAR_TIERS).
 * Routes checkout through /api/billing/checkout.
 */

import { useState } from 'react';
import { PRICING_TIERS } from '@/lib/pricing-config';

export function PricingCards() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  async function handleCheckout(tierId: string, cta: string) {
    if (cta === 'Contact Sales') {
      window.location.href = '/demo';
      return;
    }

    setLoadingTier(tierId);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tierId }),
        credentials: 'include',
      });

      if (res.status === 401) {
        window.location.href = `/signup?plan=${tierId}`;
        return;
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setLoadingTier(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {PRICING_TIERS.map(tier => (
        <div
          key={tier.id}
          className={`relative flex flex-col rounded-2xl p-6 border transition-shadow ${
            tier.highlighted
              ? 'border-orange-400 bg-orange-50 shadow-lg shadow-orange-100'
              : 'border-gray-200 bg-white hover:shadow-md'
          }`}
        >
          {tier.highlighted && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">
              Most Popular
            </div>
          )}

          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900">{tier.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{tier.description}</p>
          </div>

          <div className="mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-gray-900">{tier.price}</span>
              <span className="text-gray-500 text-sm">/mo</span>
            </div>
          </div>

          <ul className="space-y-2 flex-1 mb-6">
            {tier.features.map(f => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="material-symbols-outlined text-orange-500 text-base mt-0.5 flex-shrink-0">check_circle</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            disabled={loadingTier === tier.id}
            onClick={() => handleCheckout(tier.id, tier.cta)}
            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 ${
              tier.highlighted
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {loadingTier === tier.id ? 'Loading...' : tier.cta}
          </button>
        </div>
      ))}
    </div>
  );
}
