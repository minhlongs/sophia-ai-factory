'use client';

/**
 * Affiliate Partner Invite Redemption Form
 *
 * Public onboarding component for VIP affiliate partners to claim invitation tokens,
 * establish attribution identifiers, and configure settlement rails.
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-invite-form
 */

import React, { useState } from 'react';
import { redeemAffiliateInviteAction } from '@/forest/actions/affiliate-partner-actions';
import type { PayoutRail } from '@/forest/actions/affiliate-payout-actions-schema';

interface AffiliateInviteFormProps {
  token: string;
  onSuccess: (partnerCode: string) => void;
}

export function AffiliateInviteForm({ token, onSuccess }: AffiliateInviteFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [trafficChannel, setTrafficChannel] = useState<'youtube' | 'tiktok' | 'facebook' | 'blog_seo' | 'newsletter' | 'agency'>('youtube');
  const [preferredRail, setPreferredRail] = useState<PayoutRail>('VIETQR');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!termsAccepted) {
      setError('You must accept the affiliate partner terms');
      return;
    }

    setLoading(true);
    try {
      const res = await redeemAffiliateInviteAction({
        token,
        fullName,
        email,
        trafficChannel,
        preferredRail,
        termsAccepted: true,
      });

      if (!res.success) {
        setError(res.error || 'Failed to claim invitation');
      } else if (res.partnerCode) {
        onSuccess(res.partnerCode);
      }
    } catch {
      setError('Network communication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xl max-w-md w-full mx-auto">
      <div className="text-center pb-5 border-b border-border/60">
        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">
          VIP Partner Invitation
        </span>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Join the Sophia Creator Alliance
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Earn 20% recurring RevShare on all AI video factory subscriptions you refer.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {error && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-500">{error}</div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Full Legal Name</label>
          <input
            type="text"
            required
            placeholder="Nguyen Van A"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Email Address</label>
          <input
            type="email"
            required
            placeholder="creator@agencyos.network"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Primary Traffic Channel</label>
          <select
            value={trafficChannel}
            onChange={(e) => setTrafficChannel(e.target.value as typeof trafficChannel)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-amber-500 focus:outline-none"
          >
            <option value="youtube">YouTube (Descriptions & Shorts)</option>
            <option value="tiktok">TikTok (Bio & Showcase)</option>
            <option value="facebook">Facebook (Communities & Groups)</option>
            <option value="blog_seo">Content Blog / SEO</option>
            <option value="newsletter">Email Newsletter</option>
            <option value="agency">Agency / Enterprise Client Referrals</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Default Settlement Rail</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPreferredRail('VIETQR')}
              className={`py-2 text-xs font-medium rounded-lg border transition ${
                preferredRail === 'VIETQR'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-border bg-background text-muted-foreground'
              }`}
            >
              VietQR (VND Bank)
            </button>
            <button
              type="button"
              onClick={() => setPreferredRail('USDT')}
              className={`py-2 text-xs font-medium rounded-lg border transition ${
                preferredRail === 'USDT'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-border bg-background text-muted-foreground'
              }`}
            >
              USDT (TRC20/ERC20)
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 pt-2">
          <input
            id="terms"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 rounded border-input text-amber-600 focus:ring-amber-500"
          />
          <label htmlFor="terms" className="text-[11px] text-muted-foreground">
            I agree to the Sophia Affiliate Partner Agreement, 14-day anti-fraud hold policy, and ethical traffic guidelines.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 py-2.5 text-xs font-semibold text-white shadow-md transition disabled:opacity-50 mt-4"
        >
          {loading ? 'Activating Partner Code...' : 'Accept Invitation & Activate'}
        </button>
      </form>
    </div>
  );
}
