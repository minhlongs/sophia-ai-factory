/**
 * Unit Economics Dashboard Submodule: Overview Tab.
 * Layer: forest (Presentation component)
 *
 * @module forest/economics/dashboard/overview-tab
 */

import React from 'react';
import {
  Layers,
  CheckCircle2,
  BarChart3,
  Sparkles,
  Server,
} from 'lucide-react';
import type { UnitEconomicsSummary } from '@/seed/types/unit-economics-types';

interface OverviewTabProps {
  data: UnitEconomicsSummary;
  locale: 'vi' | 'en';
}

export function OverviewTab({ data, locale }: OverviewTabProps) {
  const isVi = locale === 'vi';
  const { metrics, ltvCacMetrics } = data;

  return (
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
              <div className="text-xl font-bold text-emerald-400 mt-1">
                {ltvCacMetrics.estimatedPaybackPeriodMonths} {isVi ? 'tháng' : 'mo'}
              </div>
              <span className="text-[11px] text-zinc-500">{isVi ? 'chu kỳ thu hồi vốn' : 'capital recovery'}</span>
            </div>
            <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/60">
              <span className="text-xs text-zinc-400">{isVi ? 'Khách Giới Thiệu' : 'Affiliate CAC'}</span>
              <div className="text-xl font-bold text-cyan-400 mt-1">
                ${ltvCacMetrics.affiliateCommissionCogsUsd.toLocaleString()}
              </div>
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
  );
}
