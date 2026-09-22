'use client';

/**
 * @module forest/economics/unit-economics-dashboard
 *
 * Real-Time Unit Economics & Cost Arbitrage Dashboard (Requirement R4)
 *
 * Visualizes:
 * - 4 Hero KPI Cards: Gross Margin %, COGS per Video, LTV:CAC Ratio, Mekong Edge Node Savings
 * - Interactive Multimodal Cost Arbitrage Simulator (Pure Cloud vs Mekong Local GPU)
 * - Provider Cost Breakdown (fal.ai, ElevenLabs, OpenRouter, Mekong GPU)
 * - Tier Unit Economics & Margin Matrix (BASIC, PREMIUM, ENTERPRISE, MASTER)
 * - LTV:CAC Unit Economics Deep-Dive with Payback Period & ARPU
 *
 * Bilingual: VI / EN support
 * Layer Rule: forest layer — imports seed/ and tree/* only, cannot import land/.
 */

import React, { useState, useMemo } from 'react';
import {
  Calculator,
  TrendingUp,
  Cpu,
  DollarSign,
  ShieldCheck,
  Zap,
  Activity,
  Server,
  Layers,
  Sparkles,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';
import { routeMultimodalCostArbitrage } from '@/tree/ai/multimodal-cost-router';

export interface UnitEconomicsDashboardProps {
  initialData: UnitEconomicsSummary;
  locale?: 'vi' | 'en';
}

export function UnitEconomicsDashboard({
  initialData,
  locale = 'vi',
}: UnitEconomicsDashboardProps) {
  const [data] = useState<UnitEconomicsSummary>(initialData);
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'tiers' | 'simulator'>('overview');
  const [simDuration, setSimDuration] = useState<number>(30);
  const [simBypassEdge, setSimBypassEdge] = useState<boolean>(false);

  const isVi = locale === 'vi';

  // Live simulation for video arbitrage calculator
  const simResult = useMemo(() => {
    return routeMultimodalCostArbitrage({
      targetDurationSeconds: simDuration,
      bypassEdge: simBypassEdge,
    });
  }, [simDuration, simBypassEdge]);

  // Pure cloud baseline for simulator comparison
  const cloudSimResult = useMemo(() => {
    return routeMultimodalCostArbitrage({
      targetDurationSeconds: simDuration,
      bypassEdge: true,
    });
  }, [simDuration]);

  const { metrics, tierEconomics, providerCosts, ltvCacMetrics } = data;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      {/* ─── Header & Navigation ─────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                {isVi ? 'Quản Trị Hiệu Quả Kinh Tế Đơn Vị' : 'Unit Economics & Margin Dashboard'}
              </h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                {isVi
                  ? 'Theo dõi lợi nhuận gộp thực tế, COGS video, LTV:CAC và tối ưu hóa hạ tầng đa mô hình'
                  : 'Real-time gross margin, infrastructure COGS per video, LTV:CAC and multi-model arbitrage'}
              </p>
            </div>
          </div>
        </div>

        {/* Status Badges & Tab Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'overview'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isVi ? 'Tổng Quan' : 'Overview'}
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'providers'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isVi ? 'Nhà Cung Cấp' : 'AI Providers'}
            </button>
            <button
              onClick={() => setActiveTab('tiers')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'tiers'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isVi ? 'Gói Dịch Vụ' : 'Tier Margins'}
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === 'simulator'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {isVi ? 'Mô Phỏng Giá Vốn' : 'Arbitrage Simulator'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4 Hero KPI Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Gross Margin % */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-emerald-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              {isVi ? 'Biên Lợi Nhuận Gộp' : 'Platform Gross Margin'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400">
              {metrics.grossMarginPct}%
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
              {metrics.grossMarginPct >= 75 ? (isVi ? 'Tối Ưu' : 'Optimal') : (isVi ? 'Đạt Chuẩn' : 'Healthy')}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {isVi ? 'Doanh thu:' : 'Revenue:'} ${metrics.totalRevenueUsd.toLocaleString()} | COGS: ${metrics.totalCogsUsd.toLocaleString()}
          </p>
        </div>

        {/* KPI 2: COGS per Video */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-cyan-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              {isVi ? 'Giá Vốn Mỗi Video' : 'COGS Per Video'}
            </span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-cyan-400">
              ${metrics.cogsPerVideoUsd.toFixed(4)}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
              {metrics.cogsPerVideoUsd < 0.10 ? (isVi ? 'Cực Thấp' : 'Ultra-Low') : 'Standard'}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {isVi ? 'Tổng sản lượng:' : 'Total Completed:'} {data.totalVideosCompleted.toLocaleString()} {isVi ? 'video' : 'videos'}
          </p>
        </div>

        {/* KPI 3: LTV:CAC Ratio */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-indigo-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              {isVi ? 'Tỷ Lệ LTV : CAC' : 'LTV : CAC Ratio'}
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-indigo-400">
              {metrics.ltvCacRatio}x
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">
              {metrics.ltvCacRatio >= 3.0 ? (isVi ? 'Xuất Sắc' : 'Outstanding') : 'Target'}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            LTV: ${metrics.ltvUsd.toLocaleString()} | CAC: ${metrics.cacUsd.toLocaleString()}
          </p>
        </div>

        {/* KPI 4: Mekong GPU Edge Savings */}
        <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/60 border border-amber-500/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              {isVi ? 'Tiết Kiệm Mekong GPU' : 'Mekong GPU Savings'}
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-amber-400">
              ${data.edgeNodeSavingsUsd.toLocaleString()}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              {data.activeEdgeNodes} {isVi ? 'Nút Online' : 'Nodes Active'}
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            {isVi ? 'Chi phí biên:' : 'Marginal Cost:'} $0.00 unmetered local edge
          </p>
        </div>
      </div>

      {/* ─── TAB 1: OVERVIEW ─────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Section: Real-time Multi-Provider Arbitrage Matrix */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  {isVi
                    ? 'Bộ Định Tuyến Tối Ưu Chi Phí Đa Mô Hình (Multi-Model Arbitrage)'
                    : 'Multimodal AI Cost Arbitrage Matrix'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {isVi
                    ? 'So sánh chi phí per-second giữa OpenRouter, fal.ai, ElevenLabs và Mekong GPU'
                    : 'Per-second cost comparison across OpenRouter, fal.ai, ElevenLabs and Mekong GPU'}
                </p>
              </div>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isVi ? 'Circuit Breaker: Hoạt Động' : 'Circuit Breaker: Healthy'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Script Stage */}
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-semibold uppercase text-zinc-300">
                    {isVi ? '1. Kịch Bản (LLM)' : '1. Script Gen (LLM)'}
                  </span>
                  <span className="text-emerald-400 font-mono">~$0.0003</span>
                </div>
                <div className="text-sm font-medium text-zinc-100">OpenRouter DeepSeek</div>
                <div className="text-xs text-zinc-400 mt-1">
                  $0.14-$0.28 / 1M tokens | {isVi ? 'Dự phòng:' : 'Fallback:'} Mekong / Claude
                </div>
              </div>

              {/* Visuals Stage */}
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-semibold uppercase text-zinc-300">
                    {isVi ? '2. Khung Hình (Images)' : '2. Visual Frames'}
                  </span>
                  <span className="text-cyan-400 font-mono">$0.010 / frame</span>
                </div>
                <div className="text-sm font-medium text-zinc-100">fal.ai Flux Schnell</div>
                <div className="text-xs text-zinc-400 mt-1">
                  6 frames = $0.060 | {isVi ? 'Dự phòng:' : 'Fallback:'} Mekong SDXL ($0.00)
                </div>
              </div>

              {/* Audio Stage */}
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-semibold uppercase text-zinc-300">
                    {isVi ? '3. Giọng Đọc (TTS)' : '3. Neural Voice'}
                  </span>
                  <span className="text-indigo-400 font-mono">$0.00003 / char</span>
                </div>
                <div className="text-sm font-medium text-zinc-100">ElevenLabs Turbo v2.5</div>
                <div className="text-xs text-zinc-400 mt-1">
                  420 chars = $0.0126 | {isVi ? 'Dự phòng:' : 'Fallback:'} Mekong Kokoro
                </div>
              </div>

              {/* Render Stage */}
              <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span className="font-semibold uppercase text-zinc-300">
                    {isVi ? '4. Dựng & Xuất (Render)' : '4. Video Synthesis'}
                  </span>
                  <span className="text-amber-400 font-mono">$0.005 flat</span>
                </div>
                <div className="text-sm font-medium text-zinc-100">CF Worker / Mekong Edge</div>
                <div className="text-xs text-zinc-400 mt-1">
                  Fast FFmpeg assembly | {isVi ? 'Chi phí biên:' : 'Marginal:'} ~$0.0001/sec
                </div>
              </div>
            </div>
          </div>

          {/* Section: LTV : CAC Unit Economics Deep Dive */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                {isVi ? 'Phân Tích Chỉ Số LTV:CAC & Hoàn Vốn' : 'LTV:CAC & Payback Analysis'}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
                  <span className="text-xs text-zinc-400">{isVi ? 'Doanh Thu TB (ARPU)' : 'ARPU'}</span>
                  <div className="text-xl font-bold text-zinc-100 mt-1">${ltvCacMetrics.arpuUsd}</div>
                  <span className="text-[11px] text-zinc-500">{isVi ? '/tháng /khách' : '/mo /client'}</span>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
                  <span className="text-xs text-zinc-400">{isVi ? 'Tỷ Lệ Rời Bỏ (Churn)' : 'Monthly Churn'}</span>
                  <div className="text-xl font-bold text-amber-400 mt-1">{ltvCacMetrics.estimatedMonthlyChurnPct}%</div>
                  <span className="text-[11px] text-zinc-500">{isVi ? 'ước tính ổn định' : 'estimated stable'}</span>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
                  <span className="text-xs text-zinc-400">{isVi ? 'Thời Gian Hoàn Vốn' : 'Payback Period'}</span>
                  <div className="text-xl font-bold text-emerald-400 mt-1">{ltvCacMetrics.estimatedPaybackPeriodMonths} {isVi ? 'tháng' : 'mo'}</div>
                  <span className="text-[11px] text-zinc-500">{isVi ? 'chu kỳ thu hồi vốn' : 'capital recovery'}</span>
                </div>
                <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
                  <span className="text-xs text-zinc-400">{isVi ? 'Khách Giới Thiệu' : 'Affiliate CAC'}</span>
                  <div className="text-xl font-bold text-cyan-400 mt-1">${ltvCacMetrics.affiliateCommissionCogsUsd.toLocaleString()}</div>
                  <span className="text-[11px] text-zinc-500">{isVi ? 'hoa hồng đã trích' : 'commission held'}</span>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {isVi
                    ? `Sophia AI Factory đang đạt tỷ lệ LTV:CAC là ${metrics.ltvCacRatio}x (cao hơn chuẩn lành mạnh SaaS 3.0x). Với thời gian hoàn vốn ${ltvCacMetrics.estimatedPaybackPeriodMonths} tháng và biên lợi nhuận gộp ${metrics.grossMarginPct}%, mỗi khách hàng mới đóng góp giá trị thặng dư ròng ổn định.`
                    : `Sophia AI Factory operates at an outstanding ${metrics.ltvCacRatio}x LTV:CAC ratio (well above the 3.0x SaaS health benchmark). With a ${ltvCacMetrics.estimatedPaybackPeriodMonths}-month payback period and ${metrics.grossMarginPct}% gross margin, new clients generate strong compound net cash flow.`}
                </p>
              </div>
            </div>

            {/* Hardware Profile & Edge Node Status */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-amber-400" />
                {isVi ? 'Hạ Tầng Mekong GPU Edge' : 'Mekong Edge Infrastructure'}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Apple Silicon M1 Max</div>
                    <div className="text-xs text-zinc-400">32-core GPU | 64GB Unified RAM</div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ONLINE
                  </span>
                </div>

                <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{isVi ? 'Giao thức kết nối:' : 'Tunnel Protocol:'}</span>
                    <span className="text-zinc-200 font-mono">Cloudflare Tunnel</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{isVi ? 'Mã hóa đầu cuối:' : 'Encryption:'}</span>
                    <span className="text-zinc-200 font-mono">AES-256-GCM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">{isVi ? 'Thời gian nhịp tim:' : 'Heartbeat Check:'}</span>
                    <span className="text-emerald-400 font-mono">&lt; 15,000ms</span>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 leading-normal">
                  {isVi
                    ? 'Tự động kích hoạt dự phòng Transparent Cloud Fallback khi nút cạnh mất kết nối hoặc độ trễ vượt 2.5s.'
                    : 'Automatic failover to Cloud BYOK if edge nodes drop heartbeat or latency exceeds 2.5s.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: AI PROVIDERS BREAKDOWN ───────────────────────────────── */}
      {activeTab === 'providers' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                {isVi ? 'Chi Tiết Chi Phí & Độ Tin Cậy Nhà Cung Cấp' : 'AI Provider Cost & Reliability Breakdown'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                {isVi
                  ? 'Theo dõi số lượng yêu cầu, chi phí thực tế, tỷ lệ lỗi và độ trễ phản hồi'
                  : 'Track job volume, aggregated COGS, error rates, and response latency per provider'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs font-semibold uppercase text-zinc-400 tracking-wider">
                  <th className="py-3 px-4">{isVi ? 'Nhà Cung Cấp' : 'Provider'}</th>
                  <th className="py-3 px-4">{isVi ? 'Tổng Tác Vụ' : 'Total Jobs'}</th>
                  <th className="py-3 px-4">{isVi ? 'Thành Công' : 'Success'}</th>
                  <th className="py-3 px-4">{isVi ? 'Chi Phí (COGS)' : 'Total Cost'}</th>
                  <th className="py-3 px-4">{isVi ? 'TB / Tác Vụ' : 'Avg / Job'}</th>
                  <th className="py-3 px-4">{isVi ? 'Tỷ Lệ Chi Phí' : 'Cost Share'}</th>
                  <th className="py-3 px-4">{isVi ? 'Độ Trễ TB' : 'Avg Latency'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {providerCosts.map((p) => (
                  <tr key={p.provider} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-zinc-200 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      {p.displayName}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300 font-mono">{p.totalJobs.toLocaleString()}</td>
                    <td className="py-3.5 px-4 text-emerald-400 font-mono">
                      {p.successfulJobs.toLocaleString()} ({((p.successfulJobs / Math.max(1, p.totalJobs)) * 100).toFixed(1)}%)
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-zinc-100">
                      ${p.totalCostUsd.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-400">
                      ${p.avgCostPerJobUsd.toFixed(4)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${Math.min(100, p.costSharePct)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-zinc-400">{p.costSharePct}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono">{p.avgLatencyMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: TIER MARGINS MATRIX ──────────────────────────────────── */}
      {activeTab === 'tiers' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              {isVi ? 'Bảng Hiệu Quả Kinh Tế Theo Gói Đăng Ký (Tier Economics)' : 'Subscription Tier Unit Economics'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isVi
                ? 'Đánh giá biên lợi nhuận thực tế theo hạn ngạch MCU và giá vốn hạ tầng trên từng gói'
                : 'Evaluate gross margins across subscription tiers based on quota consumption'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {tierEconomics.map((t) => (
              <div
                key={t.tier}
                className="bg-zinc-950/70 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      {t.tier}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t.grossMarginPct}% {isVi ? 'Lãi' : 'Margin'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-3xl font-extrabold text-zinc-100">${t.monthlyPriceUsd}</div>
                    <div className="text-xs text-zinc-500">{isVi ? 'mỗi tháng / khách' : 'per month'}</div>
                  </div>

                  <div className="mt-6 space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">{isVi ? 'Hạn ngạch video:' : 'Est. Video Quota:'}</span>
                      <span className="font-medium text-zinc-200">{t.estimatedVideoQuota} videos</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">{isVi ? 'Khách kích hoạt:' : 'Active Clients:'}</span>
                      <span className="font-medium text-zinc-200">{t.activeSubscribers}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/60">
                      <span className="text-zinc-400">{isVi ? 'Doanh thu tháng:' : 'Monthly Revenue:'}</span>
                      <span className="font-medium text-zinc-200">${t.monthlyRevenueUsd.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">{isVi ? 'Giá vốn ước tính:' : 'Est. Infra COGS:'}</span>
                      <span className="font-medium text-amber-400">${t.estimatedCogsUsd}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{isVi ? 'Đánh giá:' : 'Status:'}</span>
                    <span className="text-emerald-400 font-semibold">{t.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: ARBITRAGE SIMULATOR ──────────────────────────────────── */}
      {activeTab === 'simulator' && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              {isVi
                ? 'Công Cụ Mô Phỏng Giá Vốn Chiến Dịch (Campaign Cost Simulator)'
                : 'Interactive Campaign Cost & Arbitrage Simulator'}
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isVi
                ? 'Thay đổi thời lượng video để xem tính toán chi phí thực tế và tỷ lệ tiết kiệm giữa Cloud thuần túy vs Hybrid Edge'
                : 'Simulate per-second costs and savings across video durations comparing Pure Cloud vs Hybrid Mekong Edge'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Input Controls */}
            <div className="space-y-6 bg-zinc-950/60 border border-zinc-800 rounded-xl p-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 block mb-2">
                  {isVi ? `Thời lượng video: ${simDuration} giây` : `Video Duration: ${simDuration} seconds`}
                </label>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={simDuration}
                  onChange={(e) => setSimDuration(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[11px] text-zinc-500 mt-1 font-mono">
                  <span>10s</span>
                  <span>30s</span>
                  <span>60s</span>
                  <span>90s</span>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simBypassEdge}
                    onChange={(e) => setSimBypassEdge(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 bg-zinc-900"
                  />
                  <div>
                    <span className="text-sm font-medium text-zinc-200">
                      {isVi ? 'Bỏ qua Mekong GPU (Cloud thuần túy)' : 'Bypass Mekong GPU (Pure Cloud)'}
                    </span>
                    <p className="text-xs text-zinc-500">
                      {isVi ? 'Mô phỏng trường hợp tất cả nút GPU đều offline' : 'Force all stages to cloud BYOK'}
                    </p>
                  </div>
                </label>
              </div>

              <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs space-y-2">
                <div className="font-semibold text-zinc-300 mb-1">{isVi ? 'Cấu hình định tuyến:' : 'Routing Matrix:'}</div>
                <div className="flex justify-between text-zinc-400">
                  <span>{isVi ? 'Kịch bản:' : 'Script:'}</span>
                  <span className="text-zinc-200 font-mono">{simResult.selectedStages.script.model}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>{isVi ? 'Khung hình:' : 'Visuals:'}</span>
                  <span className="text-zinc-200 font-mono">{simResult.selectedStages.visuals.model}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>{isVi ? 'Giọng đọc:' : 'Audio:'}</span>
                  <span className="text-zinc-200 font-mono">{simResult.selectedStages.audio.model}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>{isVi ? 'Dựng video:' : 'Render:'}</span>
                  <span className="text-zinc-200 font-mono">{simResult.selectedStages.render.model}</span>
                </div>
              </div>
            </div>

            {/* Results Comparison */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Box 1: Hybrid Mekong Edge Arbitrage */}
              <div className="bg-zinc-950/80 border border-emerald-500/30 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">
                      {isVi ? 'Định Tuyến Tối Ưu (Hybrid Edge)' : 'Arbitraged Hybrid Routing'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {simResult.isMekongGpuAccelerated ? 'GPU Accelerated' : 'Cloud BYOK'}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-4xl font-extrabold text-emerald-400">
                      ${simResult.totalEstimatedCostUsd.toFixed(4)}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      ${simResult.costPerSecondUsd.toFixed(6)} {isVi ? 'trên mỗi giây video' : 'per second'}
                    </div>
                  </div>

                  <div className="mt-6 space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
                      <span>{isVi ? 'Kịch bản (Script):' : 'Script Cost:'}</span>
                      <span className="text-zinc-200 font-mono">${simResult.selectedStages.script.estimatedCostUsd}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
                      <span>{isVi ? 'Khung hình (Visuals):' : 'Visuals Cost:'}</span>
                      <span className="text-zinc-200 font-mono">${simResult.selectedStages.visuals.estimatedCostUsd}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
                      <span>{isVi ? 'Giọng đọc (Audio):' : 'Audio Cost:'}</span>
                      <span className="text-zinc-200 font-mono">${simResult.selectedStages.audio.estimatedCostUsd}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 py-1">
                      <span>{isVi ? 'Dựng video (Render):' : 'Render Cost:'}</span>
                      <span className="text-zinc-200 font-mono">${simResult.selectedStages.render.estimatedCostUsd}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <span>{isVi ? 'Tiết kiệm so với Cloud:' : 'Savings vs Cloud:'}</span>
                  <span className="font-bold font-mono">
                    ${simResult.savingsVsCloudUsd.toFixed(4)} ({simResult.savingsPercentage}%)
                  </span>
                </div>
              </div>

              {/* Box 2: Pure Cloud Baseline */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
                      {isVi ? 'Chuẩn Cloud Thuần Túy' : 'Pure Cloud Baseline'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      100% BYOK
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="text-4xl font-extrabold text-zinc-200">
                      ${cloudSimResult.totalEstimatedCostUsd.toFixed(4)}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      ${cloudSimResult.costPerSecondUsd.toFixed(6)} {isVi ? 'trên mỗi giây video' : 'per second'}
                    </div>
                  </div>

                  <div className="mt-6 space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
                      <span>{isVi ? 'Kịch bản (DeepSeek):' : 'Script (DeepSeek):'}</span>
                      <span className="text-zinc-200 font-mono">${cloudSimResult.selectedStages.script.estimatedCostUsd}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
                      <span>{isVi ? 'Khung hình (fal Flux):' : 'Visuals (fal Flux):'}</span>
                      <span className="text-zinc-200 font-mono">${cloudSimResult.selectedStages.visuals.estimatedCostUsd}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 py-1 border-b border-zinc-800">
                      <span>{isVi ? 'Giọng đọc (ElevenLabs):' : 'Audio (ElevenLabs):'}</span>
                      <span className="text-zinc-200 font-mono">${cloudSimResult.selectedStages.audio.estimatedCostUsd}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400 py-1">
                      <span>{isVi ? 'Dựng video (Worker):' : 'Render (Worker):'}</span>
                      <span className="text-zinc-200 font-mono">${cloudSimResult.selectedStages.render.estimatedCostUsd}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 flex items-center justify-between">
                  <span>{isVi ? 'Chi phí cho 1,000 video:' : 'Cost for 1,000 videos:'}</span>
                  <span className="font-bold font-mono text-zinc-200">
                    ${(cloudSimResult.totalEstimatedCostUsd * 1000).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
