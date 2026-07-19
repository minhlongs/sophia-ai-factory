/**
 * /dashboard/credits — Unified Credit Balance Page
 *
 * Shows MCU credits + one-time credit pack credits in 2 balance cards
 * (MCU + Total), plus command cost table, transaction history, and upgrade CTA.
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { redirect } from 'next/navigation';
import { getBalance, listTransactions } from '@/land/mcu/credits-repo';
import { createServerClient } from '@/seed/db/client';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const jar = await cookies();
  const locale = jar.get('NEXT_LOCALE')?.value === 'en' ? 'en' : 'vi';

  const [mcuBalance, transactions, t, tBanner] = await Promise.all([
    getBalance(user.id),
    listTransactions(user.id, 20),
    getTranslations('dashboard.credits'),
    getTranslations('dashboard.credits_low_banner'),
  ]);

  // One-time pack balance (non-expired paid packs)
  const db = createServerClient();
  const nowSec = Math.floor(Date.now() / 1000);
  const packResult = await db
    .prepare(
      `SELECT COALESCE(SUM(credits_remaining), 0) as pack_remaining,
              COALESCE(SUM(credits_total), 0) as pack_total,
              COUNT(*) as active_packs
       FROM user_purchases
       WHERE user_id = ?
         AND kind = 'one_time'
         AND status = 'paid'
         AND (expires_at IS NULL OR expires_at > ?)`,
    )
    .bind(user.id, nowSec)
    .first<{ pack_remaining: number; pack_total: number; active_packs: number }>();

  const packBalance = packResult ?? { pack_remaining: 0, pack_total: 0, active_packs: 0 };
  const totalCredits = mcuBalance.credits_remaining + packBalance.pack_remaining;

  const commandList = [
    { command: '/campaign', credits: 1, status: 'live', desc: 'Tạo campaign video', descEn: 'Create video campaign' },
    { command: '/status', credits: 0, status: 'live', desc: 'Kiểm tra trạng thái', descEn: 'Check job status' },
    { command: '/results', credits: 0, status: 'live', desc: 'Xem kết quả', descEn: 'View results' },
  ];

  const lowBalance = totalCredits < 10;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <RouteHelpTooltip locale={locale} routeKey="credits" />
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* 2-Card Balance: MCU + Total */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MCU Balance */}
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">{t('mcuAvailable', { default: 'MCU Còn Lại' })}</p>
          <p className="text-4xl font-bold text-primary tabular-nums">
            {mcuBalance.credits_remaining.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === 'en' ? 'Monthly Credit Unit' : 'Đơn Vị Tính Tháng'}
          </p>
        </div>

        {/* Total (MCU + Pack) */}
        <div className="bg-primary/5 border-primary/20 rounded-lg p-4">
          <p className="text-xs text-primary mb-1">{t('total')}</p>
          <p className="text-4xl font-bold text-primary tabular-nums">
            {totalCredits.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t('creditsUnit')}</p>
        </div>
      </div>

      {/* Credit Cost Table — how much each command costs */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">
            {locale === 'en' ? 'Credit Cost per Command' : 'Chi Phí Credit Mỗi Lệnh'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'en'
              ? 'Understand credit usage before running AI commands'
              : 'Hiểu chi phí credit trước khi chạy lệnh AI'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {locale === 'en' ? 'Command' : 'Lệnh'}
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
                  {locale === 'en' ? 'Description' : 'Mô Tả'}
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                  {locale === 'en' ? 'Credits' : 'Credit'}
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">
                  {locale === 'en' ? 'Status' : 'Trạng Thái'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {commandList.map((cmd) => (
                <tr key={cmd.command} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <code className="font-mono text-sm font-semibold text-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                      {cmd.command}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {locale === 'en' ? cmd.descEn : cmd.desc}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center justify-center font-semibold tabular-nums ${
                        cmd.credits === 0
                          ? 'text-muted-foreground'
                          : 'text-foreground'
                      }`}
                    >
                      {cmd.credits === 0
                        ? (locale === 'en' ? 'Free' : 'Miễn Phí')
                        : cmd.credits}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {cmd.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t bg-muted/10 text-xs text-muted-foreground">
          {locale === 'en'
            ? 'Tip: /campaign generates the video and costs 1 credit. /status and /results are free to check progress.'
            : 'Mẹo: /campaign tạo video và tốn 1 credit. /status và /results miễn phí để kiểm tra tiến độ.'}
        </div>
      </div>

      {/* Low balance banner */}
      {lowBalance && (
        <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-amber-300/50 dark:border-amber-700/40 shadow-lg rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground-700 dark:text-slate-300">
              {tBanner('message')}
            </p>
          </div>
          <Link
            href="/pricing"
            className="cursor-pointer shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors duration-150"
          >
            {tBanner('cta')}
          </Link>
        </div>
      )}

      {/* Transaction History */}
      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h2 className="font-semibold">{t('transactionsTitle')}</h2>
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t('noTransactions')}</p>
        ) : (
          <div className="divide-y">
            {transactions.map((tx) => (
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
