/**
 * CeoAgentShell — client shell for `/dashboard/ceo-agent`.
 *
 * Keeps the page tree small for BASIC users by lazy-loading TierGateCard.
 * Hydrates tier via GET `/api/ceo-agent/tier` so the D1 result refreshes
 * without hard navigation.
 */

'use client';

import { useState, useEffect } from 'react';
import { TierGateCardLoader } from './tier-gate-card-loader';
import { CeoAgentDashboard } from './ceo-agent-dashboard';

const TIER_VALUES = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;
type Tier = (typeof TIER_VALUES)[number];

function isTier(value: unknown): value is Tier {
  return typeof value === 'string' && TIER_VALUES.includes(value as Tier);
}

interface Props {
  locale: string;
  hasAccess: boolean;
  currentTier: Tier;
  userId: string;
}

export function CeoAgentShell({ locale, hasAccess, currentTier, userId }: Props) {
  const effectiveLocale = locale;

  const [tier, setTier] = useState(currentTier);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/${effectiveLocale}/api/ceo-agent/tier`)
      .then((r) => r.json() as Promise<{ ok?: boolean; tier?: string }>)
      .then((body: { ok?: boolean; tier?: string }) => {
        if (cancelled) return;
        if (body?.ok === false) return;
        if (isTier(body?.tier)) setTier(body.tier);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [effectiveLocale]);

  if (loading && !hasAccess) {
    return <TierGateCardLoader />;
  }

  if (!hasAccess) {
    return (
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">CEO Agent</h1>
          <p className="text-sm text-muted-foreground">Your CEO Agent — daily briefing, campaigns, and revenue insights.</p>
        </header>
        <TierGateCardLoader currentTier={tier} />
      </div>
    );
  }

  return <CeoAgentDashboard userId={userId} locale={effectiveLocale} />;
}
