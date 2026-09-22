'use client';

/**
 * Customer Health Monitor & Anti-Churn AI Guardian UI
 *
 * Real-time client retention monitor with 4-factor health scoring,
 * churn risk categorization, and 1-Click Founder Intervention modal.
 *
 * Layer: Forest (UI components & presentation)
 *
 * @module forest/growth/customer-health-monitor
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  Gift,
  Mail,
  RefreshCw,
  Send,
  Zap,
  Clock,
  ShieldAlert,
  X,
  Sparkles,
} from 'lucide-react';
import type {
  CustomerHealthMetrics,
  ChurnRiskLevel,
  RetentionSummaryStats,
  FounderInterventionResult,
} from '@/seed/types/retention-types';

export interface CustomerHealthMonitorProps {
  locale?: 'en' | 'vi';
  initialCustomers?: CustomerHealthMetrics[];
  initialSummary?: RetentionSummaryStats;
}

export function CustomerHealthMonitor({
  locale = 'vi',
  initialCustomers = [],
  initialSummary,
}: CustomerHealthMonitorProps) {
  const isVi = locale === 'vi';

  const [customers, setCustomers] = useState<CustomerHealthMetrics[]>(initialCustomers);
  const [summary, setSummary] = useState<RetentionSummaryStats | null>(initialSummary ?? null);
  const [filter, setFilter] = useState<'ALL' | ChurnRiskLevel>('ALL');
  const [loading, setLoading] = useState<boolean>(initialCustomers.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modal State for 1-Click Founder Action
  const [activeCustomer, setActiveCustomer] = useState<CustomerHealthMetrics | null>(null);
  const [bonusCredits, setBonusCredits] = useState<number>(500);
  const [customNote, setCustomNote] = useState<string>('');
  const [notifyEmail, setNotifyEmail] = useState<boolean>(true);
  const [notifyTelegram, setNotifyTelegram] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchRetentionData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/admin/customer-intervention');
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          summary: RetentionSummaryStats;
          customers: CustomerHealthMetrics[];
        };
        if (data.ok) {
          setCustomers(data.customers || []);
          setSummary(data.summary || null);
        }
      }
    } catch {
      // Non-fatal client fetch error
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCustomers.length === 0) {
      void fetchRetentionData();
    }
  }, [fetchRetentionData, initialCustomers.length]);

  const handleOpenIntervention = (cust: CustomerHealthMetrics) => {
    setActiveCustomer(cust);
    setBonusCredits(500);
    setCustomNote('');
  };

  const handleExecuteIntervention = async () => {
    if (!activeCustomer) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/customer-intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeCustomer.userId,
          bonusCredits,
          customMessage: customNote || undefined,
          notifyEmail,
          notifyTelegram,
        }),
      });

      const data = (await res.json()) as { ok: boolean; result?: FounderInterventionResult; error?: string };

      if (res.ok && data.ok) {
        setToastMessage({
          text: isVi
            ? `Đã tặng thành công +${bonusCredits} MCU cho ${activeCustomer.userEmail}!`
            : `Successfully granted +${bonusCredits} MCU to ${activeCustomer.userEmail}!`,
          type: 'success',
        });
        setActiveCustomer(null);
        await fetchRetentionData();
      } else {
        setToastMessage({
          text: data.error || (isVi ? 'Can thiệp thất bại' : 'Intervention failed'),
          type: 'error',
        });
      }
    } catch {
      setToastMessage({
        text: isVi ? 'Lỗi kết nối khi gửi yêu cầu' : 'Network error executing intervention',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  const filteredCustomers = customers.filter((cust) => {
    if (filter === 'ALL') return true;
    return cust.status === filter;
  });

  const getScoreBadgeColor = (score: number) => {
    if (score >= 70) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 40) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getScoreProgressColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* Toast alert */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-950">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {isVi ? 'Trợ Lý AI Giữ Chân Khách Hàng & Chống Rời Bỏ' : 'Autonomous Client Retention & Anti-Churn AI Guardian'}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              R1 Live
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-400 max-w-2xl">
            {isVi
              ? 'Thuật toán tính điểm Sức khỏe 4 yếu tố (0–100) theo thời gian thực từ D1. Tự động cảnh báo qua Telegram & Email khi điểm < 40 kèm can thiệp 1-Click cho Founder.'
              : 'Real-time 4-factor Customer Health scoring (0–100) from D1 telemetry. Automated Resend & Telegram alerts when health < 40 with 1-Click Founder credit grant.'}
          </p>
        </div>

        <button
          onClick={() => void fetchRetentionData()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700/60 transition shadow-sm disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          {isVi ? 'Cập nhật' : 'Sync Health'}
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monitored */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>{isVi ? 'Tổng tài khoản' : 'Monitored Accounts'}</span>
            <HeartPulse className="w-4 h-4 text-zinc-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {summary?.totalMonitored ?? customers.length}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {isVi ? 'Điểm trung bình:' : 'Avg Health Score:'}{' '}
            <span className="text-zinc-300 font-semibold">{summary?.averageHealthScore ?? 85}/100</span>
          </div>
        </div>

        {/* Card 2: Healthy */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>{isVi ? 'Tài khoản Khỏe mạnh' : 'Healthy (70-100)'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {summary?.healthyCount ?? customers.filter((c) => c.status === 'HEALTHY').length}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {isVi ? 'Hoạt động đều đặn' : 'Active & rendering'}
          </div>
        </div>

        {/* Card 3: Warning */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>{isVi ? 'Cần chú ý' : 'Warning (40-69)'}</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {summary?.warningCount ?? customers.filter((c) => c.status === 'WARNING').length}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            {isVi ? 'Giảm tần suất tạo video' : 'Velocity slowing down'}
          </div>
        </div>

        {/* Card 4: Critical Risk */}
        <div className="rounded-xl border border-rose-900/30 bg-rose-950/10 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-300 text-xs">
            <span>{isVi ? 'Nguy cơ rời bỏ cao' : 'Critical Risk (<40)'}</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">
            {summary?.criticalRiskCount ?? customers.filter((c) => c.status === 'CRITICAL_CHURN_RISK').length}
          </div>
          <div className="mt-1 text-[11px] text-rose-300/70">
            {isVi ? 'Kích hoạt Win-back tự động' : 'Win-back eligible'}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filter === 'ALL'
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {isVi ? 'Tất cả' : 'All'} ({customers.length})
        </button>
        <button
          onClick={() => setFilter('CRITICAL_CHURN_RISK')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            filter === 'CRITICAL_CHURN_RISK'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              : 'text-zinc-400 hover:text-rose-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          {isVi ? 'Nguy cơ cao (<40)' : 'Critical Risk'} (
          {customers.filter((c) => c.status === 'CRITICAL_CHURN_RISK').length})
        </button>
        <button
          onClick={() => setFilter('WARNING')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            filter === 'WARNING'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-zinc-400 hover:text-amber-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          {isVi ? 'Cảnh báo (40-69)' : 'Warning'} (
          {customers.filter((c) => c.status === 'WARNING').length})
        </button>
        <button
          onClick={() => setFilter('HEALTHY')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
            filter === 'HEALTHY'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-zinc-400 hover:text-emerald-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {isVi ? 'Khỏe mạnh (>=70)' : 'Healthy'} (
          {customers.filter((c) => c.status === 'HEALTHY').length})
        </button>
      </div>

      {/* Customer Health Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
            {isVi ? 'Đang phân tích telemetry khách hàng...' : 'Analyzing telemetry health metrics...'}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs">
            {isVi ? 'Không có khách hàng nào trong nhóm lọc này' : 'No customers match the selected filter'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{isVi ? 'Khách hàng' : 'Customer'}</th>
                  <th className="py-3 px-4">{isVi ? 'Điểm Sức khỏe' : 'Health Score'}</th>
                  <th className="py-3 px-4">{isVi ? 'Chi tiết 4 Yếu tố' : '4-Factor Breakdown'}</th>
                  <th className="py-3 px-4">{isVi ? 'Trạng thái' : 'Status'}</th>
                  <th className="py-3 px-4 text-right">{isVi ? 'Can thiệp Founder' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredCustomers.map((cust) => {
                  const initials = (cust.userName || cust.userEmail.split('@')[0])
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={cust.userId}
                      className="hover:bg-zinc-800/30 transition group"
                    >
                      {/* Customer info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-300 text-[11px] border border-zinc-700/60 shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-white">
                              {cust.userName || cust.userEmail.split('@')[0]}
                            </div>
                            <div className="text-[11px] text-zinc-400">{cust.userEmail}</div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              ID: {cust.userId.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Health Score Pill */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-md font-bold text-sm border font-mono ${getScoreBadgeColor(
                              cust.totalHealthScore,
                            )}`}
                          >
                            {cust.totalHealthScore}
                            <span className="text-[10px] font-normal text-zinc-400">/100</span>
                          </span>
                        </div>
                        <div className="w-24 bg-zinc-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${getScoreProgressColor(cust.totalHealthScore)}`}
                            style={{ width: `${cust.totalHealthScore}%` }}
                          />
                        </div>
                      </td>

                      {/* 4 Factor Breakdown */}
                      <td className="py-3.5 px-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                          <div>
                            <span className="text-zinc-500">{isVi ? 'Đăng nhập:' : 'Recency:'}</span>{' '}
                            <span className="font-semibold text-zinc-200">
                              {cust.recencyScore}/25
                            </span>{' '}
                            <span className="text-[10px] text-zinc-500">
                              ({cust.rawMetrics.daysSinceLastActive}d)
                            </span>
                          </div>

                          <div>
                            <span className="text-zinc-500">{isVi ? 'Sản lượng:' : 'Velocity:'}</span>{' '}
                            <span className="font-semibold text-zinc-200">
                              {cust.velocityScore}/25
                            </span>{' '}
                            <span className="text-[10px] text-zinc-500">
                              ({cust.rawMetrics.videosCreated30d} vid)
                            </span>
                          </div>

                          <div>
                            <span className="text-zinc-500">{isVi ? 'MCU dư:' : 'Capacity:'}</span>{' '}
                            <span className="font-semibold text-zinc-200">
                              {cust.capacityScore}/25
                            </span>{' '}
                            <span className="text-[10px] text-zinc-500">
                              ({cust.rawMetrics.creditsRemaining})
                            </span>
                          </div>

                          <div>
                            <span className="text-zinc-500">{isVi ? 'Độ ổn định:' : 'Reliability:'}</span>{' '}
                            <span className="font-semibold text-zinc-200">
                              {cust.reliabilityScore}/25
                            </span>{' '}
                            <span className="text-[10px] text-zinc-500">
                              ({Math.round(cust.rawMetrics.renderSuccessRate * 100)}%)
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status & Cooldown */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase inline-flex items-center gap-1 w-fit ${
                              cust.status === 'HEALTHY'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : cust.status === 'WARNING'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {cust.status === 'HEALTHY'
                              ? isVi ? 'Khỏe mạnh' : 'Healthy'
                              : cust.status === 'WARNING'
                                ? isVi ? 'Cảnh báo' : 'Warning'
                                : isVi ? 'Nguy cơ rời bỏ' : 'Churn Risk'}
                          </span>

                          {cust.inCooldown && (
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-zinc-400" />
                              {isVi ? 'Đang hạ nhiệt (7d)' : 'Cooldown active'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 1-Click Founder Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenIntervention(cust)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition shadow-sm"
                        >
                          <Gift className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{isVi ? 'Can thiệp 1-Click' : '1-Click Action'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 1-Click Founder Intervention Modal */}
      {activeCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>{isVi ? 'Can Thiệp Giữ Chân Khách Hàng 1-Click' : '1-Click Founder Intervention'}</span>
              </div>
              <button
                onClick={() => setActiveCustomer(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target customer card */}
            <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <div>
                <div className="font-semibold text-white text-sm">
                  {activeCustomer.userName || activeCustomer.userEmail.split('@')[0]}
                </div>
                <div className="text-xs text-zinc-400">{activeCustomer.userEmail}</div>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  ID: {activeCustomer.userId}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-zinc-400 uppercase font-semibold">
                  {isVi ? 'Điểm sức khỏe' : 'Health Score'}
                </div>
                <div
                  className={`text-lg font-bold font-mono ${
                    activeCustomer.totalHealthScore < 40
                      ? 'text-rose-400'
                      : activeCustomer.totalHealthScore < 70
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }`}
                >
                  {activeCustomer.totalHealthScore}/100
                </div>
              </div>
            </div>

            {/* Bonus MCU Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">
                {isVi ? 'Tặng MCU ưu đãi (Model Compute Units):' : 'Grant Bonus MCU (Compute Units):'}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[250, 500, 1000, 2500].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBonusCredits(amt)}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                      bonusCredits === amt
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    +{amt} MCU
                  </button>
                ))}
              </div>
            </div>

            {/* Personalized Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 block">
                {isVi ? 'Tin nhắn riêng từ Founder (Tùy chọn):' : 'Personal Founder Message (Optional):'}
              </label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder={
                  isVi
                    ? 'Tôi nhận thấy bạn đang gặp vướng mắc khi render video. Tôi tặng bạn 500 MCU để trải nghiệm thêm nhé!'
                    : 'Noticed your video runs slowed down. Here is a 500 MCU gift from me to keep creating!'
                }
                rows={3}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Notification checkboxes */}
            <div className="space-y-2 pt-1 border-t border-zinc-800 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0"
                />
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isVi ? 'Gửi email thông báo cá nhân qua Resend' : 'Send personal email via Resend'}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                <input
                  type="checkbox"
                  checked={notifyTelegram}
                  onChange={(e) => setNotifyTelegram(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-0"
                />
                <Send className="w-3.5 h-3.5 text-blue-400" />
                <span>{isVi ? 'Gửi thông báo xác nhận về Telegram Founder' : 'Send confirmation to Founder Telegram'}</span>
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveCustomer(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-white transition"
              >
                {isVi ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleExecuteIntervention()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isVi ? 'Đang thực hiện...' : 'Executing...'}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{isVi ? 'Xác nhận Can thiệp' : 'Execute Intervention'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
