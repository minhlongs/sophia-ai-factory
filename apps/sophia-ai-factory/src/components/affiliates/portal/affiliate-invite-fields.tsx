'use client';

/**
 * Affiliate Partner Invite Form Fields Sub-Component
 *
 * Layer: components/affiliates/portal
 * @module components/affiliates/portal/affiliate-invite-fields
 */

import React from 'react';
import type { PayoutRail } from '@/forest/actions/affiliate-payout-actions-schema';

export type TrafficChannel = 'youtube' | 'tiktok' | 'facebook' | 'blog_seo' | 'newsletter' | 'agency';

export interface AffiliateInviteFieldsProps {
  fullName: string;
  onFullNameChange: (val: string) => void;
  email: string;
  onEmailChange: (val: string) => void;
  trafficChannel: TrafficChannel;
  onTrafficChannelChange: (val: TrafficChannel) => void;
  preferredRail: PayoutRail;
  onPreferredRailChange: (val: PayoutRail) => void;
  termsAccepted: boolean;
  onTermsAcceptedChange: (val: boolean) => void;
}

export function AffiliateInviteFields({
  fullName,
  onFullNameChange,
  email,
  onEmailChange,
  trafficChannel,
  onTrafficChannelChange,
  preferredRail,
  onPreferredRailChange,
  termsAccepted,
  onTermsAcceptedChange,
}: AffiliateInviteFieldsProps) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Full Legal Name</label>
        <input
          type="text"
          required
          placeholder="Nguyen Van A"
          value={fullName}
          onChange={(e) => onFullNameChange(e.target.value)}
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
          onChange={(e) => onEmailChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-amber-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Primary Traffic Channel</label>
        <select
          value={trafficChannel}
          onChange={(e) => onTrafficChannelChange(e.target.value as TrafficChannel)}
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
            onClick={() => onPreferredRailChange('VIETQR')}
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
            onClick={() => onPreferredRailChange('USDT')}
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
          onChange={(e) => onTermsAcceptedChange(e.target.checked)}
          className="mt-0.5 rounded border-input text-amber-600 focus:ring-amber-500"
        />
        <label htmlFor="terms" className="text-[11px] text-muted-foreground">
          I agree to the Sophia Affiliate Partner Agreement, 14-day anti-fraud hold policy, and ethical traffic guidelines.
        </label>
      </div>
    </>
  );
}
