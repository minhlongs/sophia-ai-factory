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
import { AffiliateInviteFields, type TrafficChannel } from './affiliate-invite-fields';

export { AffiliateInviteFields, type TrafficChannel } from './affiliate-invite-fields';

interface AffiliateInviteFormProps {
  token: string;
  onSuccess: (partnerCode: string) => void;
}

export function AffiliateInviteForm({ token, onSuccess }: AffiliateInviteFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [trafficChannel, setTrafficChannel] = useState<TrafficChannel>('youtube');
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

        <AffiliateInviteFields
          fullName={fullName}
          onFullNameChange={setFullName}
          email={email}
          onEmailChange={setEmail}
          trafficChannel={trafficChannel}
          onTrafficChannelChange={setTrafficChannel}
          preferredRail={preferredRail}
          onPreferredRailChange={setPreferredRail}
          termsAccepted={termsAccepted}
          onTermsAcceptedChange={setTermsAccepted}
        />

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
