"use client";

import { Activity, Brain, CheckCircle2, ChevronRight, Zap } from "lucide-react";
import type { ByokProvider } from "@/tree/byok/resolve-user-api-key";

interface OptimizationRow {
  id: string;
  sopId: string;
  stepIndex: number;
  originalPrompt: string;
  suggestedPrompt: string;
  improvementScore: number;
  createdAt: number;
}

interface AutonomousFeedbackLoopWidgetProps {
  pendingCount: number;
  completedCount: number;
  recentOptimizations: OptimizationRow[];
  isVi: boolean;
}

export function AutonomousFeedbackLoopWidget({
  pendingCount,
  completedCount,
  recentOptimizations,
  isVi,
}: AutonomousFeedbackLoopWidgetProps) {
  const activeOptimizationsCount = recentOptimizations.length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 p-6 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/30">
      {/* Decorative background glow mesh */}
      <div className="absolute -right-20 -top-20 -z-10 h-60 w-60 rounded-full bg-cyan-500/5 blur-[80px]" />
      <div className="absolute -bottom-20 -left-20 -z-10 h-60 w-60 rounded-full bg-purple-500/5 blur-[80px]" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950/30 border border-cyan-800/30">
            <Brain className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
              {isVi ? "Vòng Lặp Phản Hồi Tự Trị" : "Autonomous Feedback Loop"}
            </h2>
            <p className="text-xs text-slate-500">
              {isVi 
                ? "Hệ thống tự động đánh giá và tối ưu hóa prompt qua LLM" 
                : "Continuous performance evaluation & prompt optimization"}
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-1 text-xs font-semibold text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </span>
          {isVi ? "ĐANG HOẠT ĐỘNG" : "ACTIVE"}
        </div>
      </div>

      {/* Grid of stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-xs font-medium">{isVi ? "Chu Kỳ Đợi Đánh Giá" : "Pending Cycles"}</span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-cyan-400">{pendingCount}</p>
        </div>

        <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-medium">{isVi ? "Chu Kỳ Hoàn Thành" : "Completed Cycles"}</span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-purple-400">{completedCount}</p>
        </div>

        <div className="col-span-2 md:col-span-1 rounded-xl border border-slate-900 bg-slate-900/20 p-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-medium">{isVi ? "Đã Tối Ưu Hóa" : "Optimizations Applied"}</span>
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-400">{activeOptimizationsCount}</p>
        </div>
      </div>

      {/* Optimizations Feed */}
      <div className="mt-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          {isVi ? "Đề Xuất Tối Ưu Hóa Gần Đây" : "Recent Optimization Log"}
        </h3>

        {recentOptimizations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-900 py-6 text-center">
            <p className="text-xs text-slate-500">
              {isVi
                ? "Chưa có đề xuất tối ưu. Chu kỳ phản hồi sẽ bắt đầu 7 ngày sau khi video được xuất bản."
                : "No optimizations logged yet. Cycles trigger evaluation 7 days post-publishing."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recentOptimizations.map((opt) => (
              <div
                key={opt.id}
                className="rounded-xl border border-slate-900 bg-slate-900/10 p-4 hover:border-slate-800 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-950 pb-2 mb-3">
                  <span className="text-xs font-semibold text-slate-300 font-mono">
                    Step {opt.stepIndex} Optimization
                  </span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/10">
                    +{Math.round(opt.improvementScore * 100)}% Est. Gain
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Original prompt */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      {isVi ? "Prompt Gốc" : "Original Prompt"}
                    </span>
                    <div className="rounded bg-red-950/10 border border-red-950/20 p-2.5 text-[11px] font-mono text-red-400 line-clamp-3">
                      {opt.originalPrompt}
                    </div>
                  </div>

                  {/* Optimized prompt */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      {isVi ? "Prompt Đã Tối Ưu" : "Optimized Prompt"}
                    </span>
                    <div className="rounded bg-emerald-950/10 border border-emerald-950/20 p-2.5 text-[11px] font-mono text-emerald-400 line-clamp-3">
                      {opt.suggestedPrompt}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
