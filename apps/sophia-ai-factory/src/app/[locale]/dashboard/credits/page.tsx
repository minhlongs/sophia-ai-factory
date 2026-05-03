/**
 * Dashboard Credits Page — /dashboard/credits
 *
 * Shows MCU balance, transaction history, and upgrade CTA.
 * Server component: fetches data from D1.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { getBalance, listTransactions } from '@/lib/mcu/credits-repo';
import { COMMANDS } from '@/lib/missions/command-registry';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [balance, transactions, t] = await Promise.all([
    getBalance(user.id),
    listTransactions(user.id, 20),
    getTranslations('dashboard.credits_low_banner'),
  ]);

  const commandList = Object.entries(COMMANDS).map(([cmd, def]) => ({
    command: cmd,
    credits: def.credits,
    status: def.status,
    description: def.description,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">MCU Credits</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Model Compute Units (MCU) power your AI commands
        </p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Available</p>
          <p className="text-3xl font-bold text-primary">{balance.credits_remaining.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">MCU</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Purchased</p>
          <p className="text-3xl font-bold">{balance.credits_total_purchased.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">MCU</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Used</p>
          <p className="text-3xl font-bold">{balance.credits_total_used.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">MCU</p>
        </div>
      </div>

      {/* Low balance banner (<10 MCU) */}
      {balance.credits_remaining < 10 && (
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-amber-300/50 dark:border-amber-700/40 shadow-lg rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {t('message')}
            </p>
          </div>
          <Link
            href="/pricing"
            className="cursor-pointer shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors duration-150"
          >
            {t('cta')}
          </Link>
        </div>
      )}

      {/* Command Pricing Table */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Command Pricing</h2>
          <p className="text-xs text-muted-foreground mt-1">MCU cost per AI command execution</p>
        </div>
        <div className="divide-y">
          {commandList.map(cmd => (
            <div key={cmd.command} className="flex items-center justify-between px-4 py-3">
              <div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{cmd.command}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{cmd.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${cmd.status === 'live' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                  {cmd.status}
                </span>
                <span className="text-sm font-medium w-16 text-right">
                  {cmd.credits === 0 ? 'Free' : `${cmd.credits} MCU`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Recent Transactions</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
        ) : (
          <div className="divide-y">
            {transactions.map(tx => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm">{tx.reason.replace(/_/g, ' ')}</p>
                  {tx.mission_id && (
                    <Link href={`/dashboard/missions/${tx.mission_id}`} className="text-xs text-muted-foreground hover:text-foreground">
                      Mission {tx.mission_id.slice(0, 8)}
                    </Link>
                  )}
                </div>
                <span className={`text-sm font-medium ${tx.delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {tx.delta > 0 ? '+' : ''}{tx.delta} MCU
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
