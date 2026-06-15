/**
 * User Wallet Page — /dashboard/wallet
 *
 * Server Component: fetches wallet balances and recent conversions from D1.
 * Displays 3 balance cards (pending / available / paid out) + transactions table.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getD1 } from '@/seed/db/client';
import { TierGateCard } from '@/seed/components/ui/tier-gate-card';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

interface WalletBalances {
  balance_pending: number;
  balance_available: number;
  balance_paid_out: number;
  currency: string;
  last_rebuilt_at: number | null;
  recent_conversions: ConversionRow[];
}

interface ConversionRow {
  id: string;
  event_type: string;
  gross_amount: number;
  commission_user: number;
  currency: string;
  payout_status: string;
  offer_id: string | null;
  created_at: string;
}

type WalletResult =
  | { kind: 'ok'; data: WalletBalances }
  | { kind: 'error' };

const STATUS_COLORS: Record<string, string> = {
  pending_clearance: 'text-yellow-400',
  available: 'text-green-400',
  paid: 'text-[var(--neon-cyan)]',
  reversed: 'text-red-400',
  unattributed: 'text-muted-foreground',
};

async function fetchWalletData(userId: string): Promise<WalletResult> {
  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');

    const wallet = await db
      .prepare(`SELECT * FROM user_wallets WHERE user_id = ?`)
      .bind(userId)
      .first<Omit<WalletBalances, 'recent_conversions'>>();

    const { results: recentConversions } = await db
      .prepare(
        `SELECT id, event_type, gross_amount, commission_user, currency, payout_status, offer_id, created_at
         FROM affiliate_conversions
         WHERE user_id = ? AND event_type != 'TEST'
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .bind(userId)
      .all<ConversionRow>();

    return {
      kind: 'ok',
      data: {
        balance_pending: wallet?.balance_pending ?? 0,
        balance_available: wallet?.balance_available ?? 0,
        balance_paid_out: wallet?.balance_paid_out ?? 0,
        currency: wallet?.currency ?? 'USD',
        last_rebuilt_at: wallet?.last_rebuilt_at ?? null,
        recent_conversions: recentConversions ?? [],
      },
    };
  } catch (err) {
    logger.error(
      '[dashboard/wallet] Failed to fetch wallet data',
      err instanceof Error ? err : new Error(String(err))
    );
    return { kind: 'error' };
  }
}

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const t = await getTranslations('dashboard.wallet');
  const tier = await resolveUserTier(user.id);

  // Wallet (affiliate earnings/payouts) requires MASTER tier
  if (tier !== 'MASTER') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('gateTitle')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <TierGateCard
          requiredTier="MASTER"
          currentTier={tier}
          featureName={t('gateTitle')}
        >
          {null}
        </TierGateCard>
      </div>
    );
  }

  const result = await fetchWalletData(user.id);

  if (result.kind === 'error') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div
          role="alert"
          className="bg-card border border-red-500/30 rounded-xl p-6 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">{t('errorTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('errorHint')}</p>
          </div>
          <Link
            href="/dashboard/wallet"
            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/30 transition-colors"
          >
            {t('errorRetry')}
          </Link>
        </div>
      </div>
    );
  }

  const data = result.data;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            {t('balancePending')}
          </p>
          <p className="text-3xl font-bold text-yellow-400">
            ${data.balance_pending.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{t('balancePendingHint')}</p>
        </div>

        <div className="bg-card border border-[var(--neon-cyan)]/30 rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            {t('balanceAvailable')}
          </p>
          <p className="text-3xl font-bold text-[var(--neon-cyan)]">
            ${data.balance_available.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{t('balanceAvailableHint')}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">
            {t('balancePaidOut')}
          </p>
          <p className="text-3xl font-bold text-foreground">
            ${data.balance_paid_out.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-2">{t('balancePaidOutHint')}</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{t('transactionsTitle')}</h2>
        </div>

        {data.recent_conversions.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div>
              <p className="text-foreground font-medium">{t('emptyTitle')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('emptyHint')}</p>
            </div>
            <Link
              href="/dashboard/integrations/affiliate-networks"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[var(--neon-cyan)]/20 to-[var(--neon-purple)]/20 border border-[var(--neon-cyan)]/40 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/10 transition-colors text-sm font-medium"
            >
              {t('emptyCta')}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{t('thDate')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{t('thType')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{t('thGross')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{t('thYourCut')}</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase">{t('thStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_conversions.map((row) => {
                  const statusKey = row.payout_status;
                  let statusLabel: string;
                  try {
                    statusLabel = t(`status.${statusKey}` as never);
                  } catch {
                    statusLabel = statusKey;
                  }
                  return (
                    <tr key={row.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-foreground">{row.event_type}</td>
                      <td className="py-3 px-4 text-sm text-foreground">
                        ${row.gross_amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-sm font-semibold text-[var(--neon-cyan)]">
                        ${row.commission_user.toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium ${STATUS_COLORS[statusKey] ?? 'text-muted-foreground'}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
