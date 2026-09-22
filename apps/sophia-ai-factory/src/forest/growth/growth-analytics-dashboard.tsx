'use client';

/**
 * Growth Analytics Executive Dashboard
 *
 * Real-time command center for tracking the $5,000 MRR milestone,
 * 10 paying customers target, 4-stage omnichannel conversion funnel,
 * channel attribution, and recent inbound lead stream.
 *
 * Layer: Forest (UI components & client interactions, imports seed/tree)
 *
 * @module forest/growth/growth-analytics-dashboard
 */

import React, { useState } from 'react';
import {
  DollarSign,
  Users,
  TrendingUp,
  Target,
  ArrowRight,
  ArrowDown,
  Layers,
  Video,
  Send,
  Search,
  Share2,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { GrowthAnalyticsSummary, FunnelStageKey } from '@/seed/types/solutions-types';
import { CustomerHealthMonitor } from './customer-health-monitor';

export interface GrowthAnalyticsDashboardProps {
  initialData: GrowthAnalyticsSummary;
  locale?: 'en' | 'vi';
}

export function GrowthAnalyticsDashboard({
  initialData,
  locale = 'vi',
}: GrowthAnalyticsDashboardProps) {
  const isVi = locale === 'vi';
  const [data, setData] = useState<GrowthAnalyticsSummary>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeStageFilter, setActiveStageFilter] = useState<FunnelStageKey | 'all'>('all');

  const { mrrProgress, funnelStages, channelAttribution, recentLeads } = data;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulating instant revalidation / refresh
    setTimeout(() => {
      setData((prev) => ({
        ...prev,
        toTimestamp: Date.now(),
      }));
      setIsRefreshing(false);
    }, 600);
  };

  const filteredLeads = recentLeads.filter((lead) => {
    if (activeStageFilter === 'all') return true;
    if (activeStageFilter === 'leads') return lead.status === 'new' || lead.status === 'qualified';
    if (activeStageFilter === 'trials') return lead.status === 'demo_sent';
    if (activeStageFilter === 'paid') return lead.status === 'converted';
    return true;
  });

  return (
    <div className="w-full space-y-8 p-6 text-zinc-100">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            {isVi ? 'Hệ Thống Tăng Trưởng Đa Kênh' : 'Omnichannel Growth Engine'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {isVi ? 'Bảng Điều Khiển Tăng Trưởng Doanh Thu' : 'Growth & Revenue Command Center'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isVi
              ? 'Theo dõi thời gian thực mục tiêu $5.000 MRR, 10 khách hàng trả phí đầu tiên và phễu chuyển đổi 4 giai đoạn.'
              : 'Real-time telemetry for the $5,000 MRR milestone, first 10 paying customers, and 4-stage funnel.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium border border-zinc-700/60 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            {isVi ? 'Làm mới số liệu' : 'Refresh Telemetry'}
          </button>
        </div>
      </div>

      {/* Top Section: $5,000 MRR & 10 Customers Milestone Trackers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric Card 1: MRR Milestone */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isVi ? 'Cột Mốc Doanh Thu MRR' : 'MRR Milestone Goal'}
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">
              ${mrrProgress.currentMrrUsd.toLocaleString()}
            </span>
            <span className="text-sm font-medium text-zinc-400">
              / ${mrrProgress.targetMrrUsd.toLocaleString()}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-zinc-400">{isVi ? 'Tiến độ' : 'Progress'}</span>
              <span className="text-emerald-400 font-semibold">{mrrProgress.progressPct}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, mrrProgress.progressPct)}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500 flex justify-between pt-1">
              <span>{isVi ? 'Còn thiếu:' : 'Remaining gap:'} ${mrrProgress.gapToTargetUsd.toLocaleString()}</span>
              <span>{isVi ? 'Mục tiêu: $5K' : 'Target: $5K'}</span>
            </div>
          </div>
        </div>

        {/* Metric Card 2: 10 Paying Customers Milestone */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-violet-500/40 transition">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isVi ? 'Mục Tiêu 10 Khách Trả Phí' : 'First 10 Customers'}
            </span>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">
              {mrrProgress.currentPayingCustomers}
            </span>
            <span className="text-sm font-medium text-zinc-400">
              / {mrrProgress.targetPayingCustomers} {isVi ? 'khách' : 'active'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-zinc-400">{isVi ? 'Tiến độ' : 'Progress'}</span>
              <span className="text-violet-400 font-semibold">
                {mrrProgress.customerProgressPct}%
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, mrrProgress.customerProgressPct)}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500 flex justify-between pt-1">
              <span>{isVi ? 'Còn lại:' : 'Remaining:'} {mrrProgress.customerGap} {isVi ? 'khách' : 'users'}</span>
              <span>10 Customers Goal</span>
            </div>
          </div>
        </div>

        {/* Metric Card 3: ARPU (Average Revenue Per User) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isVi ? 'Doanh Thu TB / Khách (ARPU)' : 'Average Revenue (ARPU)'}
            </span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">
              ${mrrProgress.arpu}
            </span>
            <span className="text-sm font-medium text-zinc-400">
              / {isVi ? 'tháng' : 'month'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-4">
            {isVi
              ? 'Tỉ trọng: Starter ($199), Growth ($399), Premium ($799).'
              : 'Weighted across Starter ($199), Growth ($399), Premium ($799).'}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
            <Zap className="w-3.5 h-3.5" />
            <span>{isVi ? 'Lợi nhuận gộp biên độ cao' : 'High-margin SaaS profile'}</span>
          </div>
        </div>

        {/* Metric Card 4: Radial Runway Velocity */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-sm relative overflow-hidden group hover:border-cyan-500/40 transition flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
              {isVi ? 'Tốc Độ Cán Đích $5K' : 'Runway Velocity'}
            </span>
            <div className="text-2xl font-bold text-white">
              {mrrProgress.runwayVelocityPct}%
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-[130px]">
              {isVi ? 'Dựa trên tốc độ chuyển đổi tuần qua' : 'Based on 30-day cohort run rate'}
            </p>
          </div>

          {/* SVG Radial Gauge */}
          <div className="relative w-18 h-18 flex items-center justify-center">
            <svg className="w-18 h-18 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-zinc-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-cyan-400 transition-all duration-700"
                strokeDasharray={`${Math.min(100, mrrProgress.runwayVelocityPct)}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-[11px] font-bold text-white">
              {mrrProgress.runwayVelocityPct}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Section: Visual 4-Stage Conversion Funnel */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800/80 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">
                {isVi ? 'Phễu Chuyển Đổi Doanh Thu 4 Giai Đoạn' : '4-Stage Omnichannel Conversion Funnel'}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              {isVi
                ? 'Đo lường từng điểm chạm từ tiếp cận người xem đến chốt hợp đồng trả phí trên Cloudflare D1.'
                : 'Direct measurement from initial view impression to paid activation recorded in D1.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {isVi ? 'Lọc theo giai đoạn:' : 'Filter stage:'}
            </span>
            <div className="inline-flex rounded-lg bg-zinc-800/80 p-0.5 border border-zinc-700/60 text-xs">
              {(['all', 'leads', 'trials', 'paid'] as const).map((stage) => (
                <button
                  key={stage}
                  onClick={() => setActiveStageFilter(stage)}
                  className={`px-3 py-1 rounded-md transition font-medium capitalize ${
                    activeStageFilter === stage
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Funnel Stage Flow Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {funnelStages.map((stage, idx) => {
            const isFirst = idx === 0;
            const stageColors = [
              'border-blue-500/30 bg-blue-500/5',
              'border-amber-500/30 bg-amber-500/5',
              'border-purple-500/30 bg-purple-500/5',
              'border-emerald-500/30 bg-emerald-500/5',
            ];
            const badgeColors = [
              'bg-blue-500/10 text-blue-400',
              'bg-amber-500/10 text-amber-400',
              'bg-purple-500/10 text-purple-400',
              'bg-emerald-500/10 text-emerald-400',
            ];

            return (
              <div
                key={stage.stage}
                className={`rounded-xl border ${stageColors[idx]} p-5 relative flex flex-col justify-between transition-all hover:scale-[1.01]`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeColors[idx]}`}>
                      Stage {idx + 1}
                    </span>
                    {!isFirst && (
                      <span className="text-xs font-semibold text-emerald-400">
                        {stage.conversionRateFromPrev}% CR
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-200">
                    {isVi ? stage.labelVi : stage.labelEn}
                  </h3>

                  <div className="mt-4 text-3xl font-extrabold text-white tracking-tight">
                    {stage.count.toLocaleString()}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/60 text-xs flex justify-between items-center text-zinc-400">
                  <span>{isVi ? 'Tỉ lệ rớt khách (Drop-off):' : 'Stage Drop-off:'}</span>
                  <span className={`font-medium ${stage.dropoffRateFromPrev > 50 ? 'text-rose-400' : 'text-zinc-300'}`}>
                    {stage.dropoffRateFromPrev}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two Column Layout: Channel Attribution & Recent Lead Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Channel Attribution Breakdown */}
        <div className="lg:col-span-7 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-400" />
              <h3 className="font-bold text-white text-base">
                {isVi ? 'Phân Bổ Kênh Thu Hút Doanh Thu' : 'Channel Attribution Breakdown'}
              </h3>
            </div>
            <span className="text-xs text-zinc-400">
              {isVi ? 'Nguồn gốc lưu lượng' : 'Acquisition Source'}
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-800/50 text-zinc-400 font-semibold uppercase text-[10px] tracking-wider border-b border-zinc-700/60">
                <tr>
                  <th className="py-3 px-3">{isVi ? 'Kênh tiếp cận' : 'Channel'}</th>
                  <th className="py-3 px-3 text-right">{isVi ? 'Lượt xem' : 'Visitors'}</th>
                  <th className="py-3 px-3 text-right">{isVi ? 'Leads' : 'Leads'}</th>
                  <th className="py-3 px-3 text-right">{isVi ? 'Trả phí' : 'Paid'}</th>
                  <th className="py-3 px-3 text-right">{isVi ? 'Tỉ lệ CR' : 'CR %'}</th>
                  <th className="py-3 px-3 text-right">{isVi ? 'Đóng góp MRR' : 'MRR'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {channelAttribution.map((ch) => {
                  const getIcon = () => {
                    switch (ch.channel) {
                      case 'viral_videos':
                        return <Video className="w-4 h-4 text-rose-400" />;
                      case 'telegram_bot':
                        return <Send className="w-4 h-4 text-sky-400" />;
                      case 'programmatic_seo':
                        return <Search className="w-4 h-4 text-emerald-400" />;
                      case 'affiliate_partners':
                        return <Share2 className="w-4 h-4 text-amber-400" />;
                      default:
                        return <Layers className="w-4 h-4 text-zinc-400" />;
                    }
                  };

                  return (
                    <tr key={ch.channel} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-3 font-medium text-white flex items-center gap-2">
                        {getIcon()}
                        <span>{isVi ? ch.channelLabelVi : ch.channelLabelEn}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-300">
                        {ch.visitors.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-300">
                        {ch.leads.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                        {ch.paid}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-zinc-300">
                        {ch.conversionRatePct}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold text-white">
                        ${ch.mrrContributionUsd.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (5 cols): Recent Inbound Lead Feed */}
        <div className="lg:col-span-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  {isVi ? 'Dòng Khách Hàng Tiềm Năng Mới' : 'Recent Inbound Leads'}
                </h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                Live Feed
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {filteredLeads.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
                  {isVi ? 'Không có khách hàng nào trong bộ lọc này.' : 'No leads matching active filter.'}
                </div>
              ) : (
                filteredLeads.map((lead) => {
                  const getStatusBadge = () => {
                    switch (lead.status) {
                      case 'converted':
                        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      case 'checkout_opened':
                        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                      case 'demo_sent':
                        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                      case 'qualified':
                        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                      default:
                        return 'bg-zinc-700/30 text-zinc-300 border-zinc-700';
                    }
                  };

                  return (
                    <div
                      key={lead.id}
                      className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 flex items-center justify-between hover:border-zinc-700 transition text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-semibold text-xs border border-zinc-700/50">
                          {lead.nameOrChat.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-white truncate max-w-[140px] sm:max-w-[180px]">
                            {lead.nameOrChat}
                          </div>
                          <div className="text-[11px] text-zinc-400 capitalize">
                            {lead.niche} • {lead.source.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold capitalize ${getStatusBadge()}`}>
                          {lead.status.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Score: {lead.score}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-zinc-800/60 text-center">
            <span className="text-[11px] text-zinc-500">
              {isVi ? 'Tự động đồng bộ từ Telegram Bot & D1 Database' : 'Synced live from Telegram Bot & D1'}
            </span>
          </div>
        </div>
      </div>

      {/* Autonomous Client Retention & Anti-Churn AI Guardian (R1) */}
      <div className="pt-4 border-t border-zinc-800/80">
        <CustomerHealthMonitor locale={locale} />
      </div>
    </div>
  );
}
