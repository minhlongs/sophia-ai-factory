'use client';

/**
 * Stripe Connect Card — onboard CTA + status badge.
 * Calls POST /api/connect/onboard and follows the returned Account Link.
 */

import { useState } from 'react';

interface Props {
  accountId: string | null;
  accountStatus: string | null;
  payoutEnabled: boolean;
  onboardingStartedAt: string | null;
}

type Variant = 'idle' | 'pending' | 'enabled' | 'restricted' | 'rejected';

function deriveVariant(p: Props): Variant {
  if (p.payoutEnabled) return 'enabled';
  if (p.accountStatus === 'rejected') return 'rejected';
  if (p.accountStatus === 'restricted') return 'restricted';
  if (p.accountStatus === 'pending' && p.accountId) return 'pending';
  return 'idle';
}

const COPY: Record<Variant, { title: string; body: string; cta: string }> = {
  idle: {
    title: 'Get paid in USD',
    body: 'Complete a one-time KYC via Stripe Connect Express. Settles within 3 business days; ~0.25% + $2 per payout.',
    cta: 'Start Stripe onboarding',
  },
  pending: {
    title: 'Onboarding in progress',
    body: 'You started but did not finish. Resume to complete KYC.',
    cta: 'Resume onboarding',
  },
  enabled: {
    title: 'Fiat payouts active',
    body: 'You are routed to Stripe Transfer first. USDT methods below act as a fallback only if Stripe transfer fails.',
    cta: 'Update Stripe details',
  },
  restricted: {
    title: 'Action required',
    body: 'Stripe needs more information before fiat payouts can run. Complete the requested steps.',
    cta: 'Provide info to Stripe',
  },
  rejected: {
    title: 'KYC rejected',
    body: 'Stripe rejected this account. Contact support to retry or switch to USDT.',
    cta: 'Contact support',
  },
};

const BADGE_CLASS: Record<Variant, string> = {
  idle: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-500/10 text-yellow-500',
  enabled: 'bg-green-500/10 text-green-500',
  restricted: 'bg-orange-500/10 text-orange-500',
  rejected: 'bg-red-500/10 text-red-500',
};

function maskAccount(id: string | null): string {
  if (!id) return '';
  return id.length > 10 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

export function StripeConnectCard(props: Props): React.JSX.Element {
  const variant = deriveVariant(props);
  const copy = COPY[variant];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick(): Promise<void> {
    if (variant === 'rejected') {
      window.location.href = 'mailto:support@mekongmind.com?subject=Stripe Connect KYC';
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/connect/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { url: string };
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to start onboarding');
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="font-semibold">{copy.title}</h3>
        <span
          className={`text-xs uppercase tracking-wide px-2 py-1 rounded ${BADGE_CLASS[variant]}`}
        >
          {variant}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{copy.body}</p>

      {props.accountId && (
        <div className="text-xs font-mono text-muted-foreground mb-4">
          Account: {maskAccount(props.accountId)}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md border accent/40 accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20 transition disabled:opacity-50"
      >
        {busy ? 'Redirecting…' : copy.cta}
      </button>

      {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
    </div>
  );
}
