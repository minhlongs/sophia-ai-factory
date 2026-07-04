'use client';

/**
 * Creator Dashboard Tabs
 *
 * Client component that manages tab navigation (My SOPs / Earnings / Payouts)
 * and renders the corresponding content. Receives server-fetched data as props.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  FileText, DollarSign, Wallet, Plus, TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SopTemplateRow } from '@/tree/sop/sop-types';
import { CreatorPayoutsSection } from '@/forest/components/sop/creator-payouts-section';

type TabKey = 'my-sops' | 'earnings' | 'payouts';

interface SalesEntry {
  count: number;
  revenue: number;
}

interface EarningsSummary {
  totalEarned: number;
  pending: number;
  payable: number;
  paid: number;
}

interface Props {
  templates: SopTemplateRow[];
  salesMap: Record<string, SalesEntry>;
  earnings: EarningsSummary;
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: SopTemplateRow['status']) {
  const map: Record<string, string> = {
    draft: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    published: 'bg-green-500/10 text-green-400 border-green-500/20',
    archived: 'bg-white/5 text-white/40 border-white/10',
    pending_review: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return map[status] ?? map.draft;
}

export function CreatorDashboardTabs({ templates, salesMap, earnings }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>('my-sops');
  const t = useTranslations('sop.creator');

  const tabs: { key: TabKey; label: string; icon: LucideIcon }[] = [
    { key: 'my-sops', label: t('tabs.mySops'), icon: FileText },
    { key: 'earnings', label: t('tabs.earnings'), icon: DollarSign },
    { key: 'payouts', label: t('tabs.payouts'), icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500/20">
            <FileText className="w-5 h-5 text-primary-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
            <p className="text-sm text-white/50">{t('subtitle')}</p>
          </div>
        </div>
        <Link
          href="/dashboard/sop-creator/new"
          className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg bg-primary-600 hover:bg-primary-500 text-sm font-medium text-white transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t('newSop')}
        </Link>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10 pb-0 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap min-h-[44px] ${
              activeTab === tab.key
                ? 'bg-white/10 text-primary-400 border-b-2 border-primary-400'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panes */}
      {activeTab === 'my-sops' && <MySopsPane templates={templates} salesMap={salesMap} />}
      {activeTab === 'earnings' && <EarningsPane earnings={earnings} />}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          <CreatorPayoutsSection />
        </div>
      )}
    </div>
  );
}

function MySopsPane({
  templates,
  salesMap,
}: {
  templates: SopTemplateRow[];
  salesMap: Record<string, SalesEntry>;
}) {
  const t = useTranslations('sop.creator');
  const tc = useTranslations('sop.categories');
  const ts = useTranslations('sop.status');

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-2 px-4 md:px-5 py-3 md:py-4 border-b border-white/10">
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
            className="flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-lg bg-primary-600 hover:bg-primary-500 text-sm font-medium text-white transition-colors"
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
                <th className="px-3 md:px-5 py-3 text-left font-medium">{t('name')}</th>
                <th className="px-2 md:px-4 py-3 text-left font-medium">{t('category')}</th>
                <th className="px-2 md:px-4 py-3 text-left font-medium">{t('status')}</th>
                <th className="px-2 md:px-4 py-3 text-right font-medium">{t('sales')}</th>
                <th className="px-2 md:px-4 py-3 text-right font-medium">{t('revenue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {templates.map((tpl) => {
                const s = salesMap[tpl.id] ?? { count: 0, revenue: 0 };
                return (
                  <tr key={tpl.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-3 md:px-5 py-3">
                      <Link
                        href={`/dashboard/sop-creator/${tpl.id}`}
                        className="font-medium text-white hover:text-primary-300 transition-colors"
                      >
                        {tpl.name_en}
                      </Link>
                      <p className="text-xs text-white/40 mt-0.5">{tpl.name_vi}</p>
                    </td>
                    <td className="px-2 md:px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border capitalize ${statusBadge(tpl.status)}`}>
                        {ts(tpl.status as 'draft' | 'published' | 'archived' | 'pending_review')}
                      </span>
                    </td>
                    <td className="px-2 md:px-4 py-3 text-right text-white/70">{s.count}</td>
                    <td className="px-2 md:px-4 py-3 text-right text-white/70">{formatUsd(s.revenue)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EarningsPane({ earnings }: { earnings: EarningsSummary }) {
  const t = useTranslations('sop.creator');

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: t('totalEarned'), value: formatUsd(earnings.totalEarned), icon: DollarSign, color: 'text-primary-400' },
        { label: t('pending'), value: formatUsd(earnings.pending), icon: TrendingUp, color: 'text-yellow-400' },
        { label: t('payable'), value: formatUsd(earnings.payable), icon: TrendingUp, color: 'text-green-400' },
        { label: t('paid'), value: formatUsd(earnings.paid), icon: DollarSign, color: 'text-white/60' },
      ].map((card) => (
        <div key={card.label} className="rounded-xl bg-white/5 border border-white/10 p-3 md:p-4">
          <div className="flex items-center gap-2 mb-2">
            <card.icon className={`w-4 h-4 ${card.color}`} aria-hidden="true" />
            <span className="text-xs text-white/50">{card.label}</span>
          </div>
          <p className="text-base md:text-lg font-semibold text-white">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
