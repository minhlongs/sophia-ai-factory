/**
 * Affiliate Payout Methods — /dashboard/affiliate/payouts
 *
 * Server Component. Renders both rails side-by-side:
 *  - Stripe Connect Express status (fiat USD)
 *  - USDT crypto methods list (TRC20 / ERC20)
 *
 * Source of truth: `user_payout_settings` for Stripe, `payout_methods` for USDT.
 * Routing precedence enforced by `src/land/payouts/resolve-payout-method.ts`.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StripeConnectCard } from './stripe-connect-card';
import { UsdtMethodsSection, type UsdtMethodRow } from './usdt-methods-section';

export const dynamic = 'force-dynamic';

interface StripeStatusRow {
  stripe_account_id: string | null;
  stripe_account_status: string | null;
  stripe_payout_enabled: number | null;
  stripe_onboarding_started_at: string | null;
}

export default async function AffiliatePayoutsPage(): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const db = getD1();
  if (!db) throw new Error('D1 database binding not available');

  const stripeRow = (await db
    .prepare(
      `SELECT stripe_account_id, stripe_account_status, stripe_payout_enabled,
              stripe_onboarding_started_at
       FROM user_payout_settings WHERE user_id = ? LIMIT 1`,
    )
    .bind(user.id)
    .first()) as StripeStatusRow | null;

  const usdtResult = await db
    .prepare(
      `SELECT id, method, display_label, is_default, verified, created_at
       FROM payout_methods
       WHERE tenant_id = ? AND affiliate_id = ?
       ORDER BY is_default DESC, created_at DESC`,
    )
    .bind(user.id, user.id)
    .all<UsdtMethodRow>();

  const usdtMethods = usdtResult.results ?? [];
  const stripeEnabled = stripeRow?.stripe_payout_enabled === 1;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="mb-8">
        <Link
          href="/dashboard/affiliate"
          className="text-sm text-muted-foreground hover:text-foreground mb-2 inline-block"
        >
          ← Back to dashboard
        </Link>
        <h1 className="text-3xl font-bold mb-2">Payout Methods</h1>
        <p className="text-muted-foreground">
          Choose how you receive commissions. Stripe Connect (fiat USD) takes precedence when
          enabled; otherwise we route to your default USDT method.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Fiat USD — Stripe Connect</h2>
        <StripeConnectCard
          accountId={stripeRow?.stripe_account_id ?? null}
          accountStatus={stripeRow?.stripe_account_status ?? null}
          payoutEnabled={stripeEnabled}
          onboardingStartedAt={stripeRow?.stripe_onboarding_started_at ?? null}
        />
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Crypto — USDT (TRC20 / ERC20)</h2>
        <UsdtMethodsSection initialMethods={usdtMethods} />
      </section>

      <footer className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <strong className="text-foreground">Routing rule:</strong> if Stripe Connect is enabled,
        we send fiat USD via Stripe Transfer. Otherwise we send USDT to your default crypto
        method. Weekly cron runs Sunday 12:00 UTC; minimum payout is $10.
      </footer>
    </div>
  );
}
