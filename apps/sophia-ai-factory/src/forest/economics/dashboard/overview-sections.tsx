/**
 * Arbitrage Matrix and Edge Node Infrastructure Cards for Unit Economics Overview Tab.
 * @module forest/economics/dashboard/overview-sections
 */

import React from 'react';
import { Layers, CheckCircle2, Server } from 'lucide-react';

export function ArbitrageMatrixCard({ isVi }: { isVi: boolean }) {
  return (
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
  );
}

export function MekongEdgeStatusCard({ isVi }: { isVi: boolean }) {
  return (
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
  );
}
