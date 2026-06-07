import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { listTemplatesByAuthor, listCreatorSales } from '@/tree/sop/sop-repo';
import { Palette, DollarSign, Plus, FileText, TrendingUp } from 'lucide-react';
import type { SopTemplateRow } from '@/tree/sop/sop-types';
import { getD1 } from '@/seed/db/get-d1';

interface Props { params: Promise<{ locale: string }> }

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('sop.creator');
  return { title: t('pageTitle') };
}


interface EarningsSummary {
  totalEarned: number; pending: number; payable: number; paid: number;
}

const ZERO_EARNINGS: EarningsSummary = { totalEarned: 0, pending: 0, payable: 0, paid: 0 };

async function fetchEarnings(userId: string, db: D1Database): Promise<EarningsSummary> {
  try {
    const { getCreatorEarnings } = await import('@/land/sop-marketplace');
    return await getCreatorEarnings(db, userId);
  } catch { return ZERO_EARNINGS; }
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: SopTemplateRow['status']) {
  const map = {
    draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    archived: 'bg-white/5 text-white/40 border-white/10',
  };
  return map[status] ?? map.draft;
}

export default async function CreatorDashboardPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('sop.creator');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const tier = await resolveUserTier(user.id);
  if (tier !== 'MASTER') redirect(`/${locale}/pricing`);

  const db = getD1();
  if (!db) notFound();

  const [templates, sales, earnings] = await Promise.all([
    listTemplatesByAuthor(db, user.id),
    listCreatorSales(db, user.id).catch(() => []),
    fetchEarnings(user.id, db),
  ]);

  const salesMap = new Map<string, { count: number; revenue: number }>();
  for (const s of sales as Array<{ template_id: string; price_cents: number }>) {
    const prev = salesMap.get(s.template_id) ?? { count: 0, revenue: 0 };
    salesMap.set(s.template_id, { count: prev.count + 1, revenue: prev.revenue + (s.price_cents ?? 0) });
  }

  const tc = await getTranslations('sop.categories');
  const ts = await getTranslations('sop.status');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20">
            <Palette className="w-5 h-5 text-violet-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
            <p className="text-sm text-white/50">{t('subtitle')}</p>
          </div>
        </div>
        <Link
          href="/dashboard/sop-creator/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t('newSop')}
        </Link>
      </div>

      {/* Earnings summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('totalEarned'), value: formatUsd(earnings.totalEarned), icon: DollarSign, color: 'text-violet-400' },
          { label: t('pending'), value: formatUsd(earnings.pending), icon: TrendingUp, color: 'text-yellow-400' },
          { label: t('payable'), value: formatUsd(earnings.payable), icon: TrendingUp, color: 'text-green-400' },
          { label: t('paid'), value: formatUsd(earnings.paid), icon: DollarSign, color: 'text-white/60' },
        ].map(card => (
          <div key={card.label} className="rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} aria-hidden="true" />
              <span className="text-xs text-white/50">{card.label}</span>
            </div>
            <p className="text-lg font-semibold text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* SOPs table */}
      <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/10">
          <FileText className="w-4 h-4 text-white/50" aria-hidden="true" />
          <h2 className="text-sm font-medium text-white/80">{t('yourSops')} ({templates.length})</h2>
        </div>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-white/20 mb-3" aria-hidden="true" />
            <p className="text-sm text-white/50">{t('noSops')}</p>
            <p className="text-xs text-white/30 mt-1 mb-4">{t('noSopsDesc')}</p>
            <Link
              href="/dashboard/sop-creator/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {t('createFirst')}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-white/40">
                  <th className="px-5 py-3 text-left font-medium">{t('name')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('category')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('status')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('sales')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {templates.map(tpl => {
                  const s = salesMap.get(tpl.id) ?? { count: 0, revenue: 0 };
                  return (
                    <tr key={tpl.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/sop-creator/${tpl.id}`}
                          className="font-medium text-white hover:text-violet-300 transition-colors"
                        >
                          {tpl.name_en}
                        </Link>
                        <p className="text-xs text-white/40 mt-0.5">{tpl.name_vi}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-white/60 text-xs">{tc(tpl.category)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border capitalize ${statusBadge(tpl.status)}`}>
                          {ts(tpl.status as 'draft' | 'published' | 'archived')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white/70">{s.count}</td>
                      <td className="px-4 py-3 text-right text-white/70">{formatUsd(s.revenue)}</td>
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
