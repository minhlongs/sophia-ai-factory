/**
 * /dashboard/sop-creator — MASTER-only creator dashboard.
 * Shows earnings summary, SOP list with status/sales, and create button.
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { listTemplatesByAuthor, listCreatorSales } from '@/lib/sop/sop-repo';
import { Palette, DollarSign, Plus, FileText, TrendingUp } from 'lucide-react';
import type { SopTemplateRow } from '@/lib/sop/sop-types';

interface Props { params: Promise<{ locale: string }> }

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Creator Dashboard | Sophia AI' };
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

interface EarningsSummary {
  totalEarned: number;
  pending: number;
  payable: number;
  paid: number;
}

const ZERO_EARNINGS: EarningsSummary = { totalEarned: 0, pending: 0, payable: 0, paid: 0 };

async function fetchEarnings(userId: string, db: D1Database): Promise<EarningsSummary> {
  try {
    const { getCreatorEarnings } = await import('@/land/sop-marketplace');
    return await getCreatorEarnings(db, userId);
  } catch {
    return ZERO_EARNINGS;
  }
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

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const tier = await getUserTier(user.id);
  if (tier !== 'MASTER') redirect(`/${locale}/pricing`);

  const db = getD1();

  const [templates, sales, earnings] = await Promise.all([
    db ? listTemplatesByAuthor(db, user.id) : Promise.resolve([] as SopTemplateRow[]),
    db ? listCreatorSales(db, user.id).catch(() => []) : Promise.resolve([]),
    db ? fetchEarnings(user.id, db) : Promise.resolve(ZERO_EARNINGS),
  ]);

  const salesMap = new Map<string, { count: number; revenue: number }>();
  for (const s of sales as Array<{ template_id: string; price_cents: number }>) {
    const prev = salesMap.get(s.template_id) ?? { count: 0, revenue: 0 };
    salesMap.set(s.template_id, { count: prev.count + 1, revenue: prev.revenue + (s.price_cents ?? 0) });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20">
            <Palette className="w-5 h-5 text-violet-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Creator Dashboard</h1>
            <p className="text-sm text-white/50">Manage your SOP templates and earnings</p>
          </div>
        </div>
        <Link
          href="/dashboard/sop-creator/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create New SOP
        </Link>
      </div>

      {/* Earnings summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Earned', value: formatUsd(earnings.totalEarned), icon: DollarSign, color: 'text-violet-400' },
          { label: 'Pending', value: formatUsd(earnings.pending), icon: TrendingUp, color: 'text-yellow-400' },
          { label: 'Payable', value: formatUsd(earnings.payable), icon: TrendingUp, color: 'text-green-400' },
          { label: 'Paid Out', value: formatUsd(earnings.paid), icon: DollarSign, color: 'text-white/60' },
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
          <h2 className="text-sm font-medium text-white/80">Your SOPs ({templates.length})</h2>
        </div>

        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-10 h-10 text-white/20 mb-3" aria-hidden="true" />
            <p className="text-sm text-white/50">No SOPs yet</p>
            <p className="text-xs text-white/30 mt-1 mb-4">Create your first SOP template to start earning</p>
            <Link
              href="/dashboard/sop-creator/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition-colors"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Create First SOP
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-xs text-white/40">
                  <th className="px-5 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Sales</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {templates.map(t => {
                  const s = salesMap.get(t.id) ?? { count: 0, revenue: 0 };
                  return (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/dashboard/sop-creator/${t.id}`}
                          className="font-medium text-white hover:text-violet-300 transition-colors"
                        >
                          {t.name_en}
                        </Link>
                        <p className="text-xs text-white/40 mt-0.5">{t.name_vi}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-white/60 text-xs">{t.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border capitalize ${statusBadge(t.status)}`}>
                          {t.status}
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
