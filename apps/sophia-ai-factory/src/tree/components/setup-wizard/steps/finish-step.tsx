"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Rocket,
  LayoutDashboard,
  Key,
  RefreshCw,
} from "lucide-react";
import { Link } from "@/navigation";
import {
  ReadinessScorecard,
  type ReadinessState,
} from "./readiness-scorecard";

export type { ReadinessState };

export interface FinishStepProps {
  saveError: string | null;
  saveFailed?: boolean;
  onRetry?: () => void;
  onNavigateToStep?: (stepIndex: number) => void;
}

export function FinishStep({
  saveError,
  saveFailed,
  onRetry,
  onNavigateToStep,
}: FinishStepProps) {
  const [readiness, setReadiness] = useState<ReadinessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchReadiness = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/setup-wizard/readiness");
      if (!res.ok) {
        throw new Error(`Failed to load readiness status (${res.status})`);
      }
      const data = (await res.json()) as ReadinessState;
      setReadiness(data);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : "Unable to verify readiness"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  const isReady = Boolean(readiness?.readyForMissions && !saveFailed);

  return (
    <div className="space-y-6 text-center py-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border ${
          isReady
            ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400"
            : "bg-[#D97706]/10 dark:bg-[#F59E0B]/10 border-[#D97706]/25 dark:border-[#F59E0B]/25 text-[#D97706] dark:text-[#F59E0B]"
        }`}
      >
        {isReady ? (
          <CheckCircle2 className="w-9 h-9" />
        ) : (
          <AlertTriangle className="w-9 h-9" />
        )}
      </div>

      <div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 border ${
            isReady
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : "bg-[#D97706]/10 dark:bg-[#F59E0B]/10 border-[#D97706]/20 dark:border-[#F59E0B]/20 text-[#D97706] dark:text-[#F59E0B]"
          }`}
        >
          {isReady
            ? "Setup Complete / Cấu hình hoàn tất"
            : "Verification Notice / Cần hoàn thiện cấu hình"}
        </span>
        <h2 className="text-2xl font-bold text-foreground tracking-tight">
          {isReady
            ? "Sophia is Ready / Sophia đã sẵn sàng!"
            : "Configuration Incomplete / Cấu hình chưa đầy đủ"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
          {isReady
            ? "Your AI Video Empire is verified and ready. Launch your first autonomous mission below."
            : "Some essential capabilities or provider credentials are still missing. Review the scorecard below."}
        </p>
      </div>

      <ReadinessScorecard
        readiness={readiness}
        loading={loading}
        fetchError={fetchError}
        onRefresh={fetchReadiness}
      />

      {saveFailed && (
        <div className="max-w-md mx-auto space-y-3">
          <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive text-left flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lưu cấu hình thất bại / Save Failed</p>
              <p>{saveError || "Failed to finalize setup credentials"}</p>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#4338CA] dark:bg-[#6366F1] text-white text-sm font-semibold hover:opacity-95 transition-all shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại / Retry Finalize
            </button>
          )}
        </div>
      )}

      <div className="max-w-md mx-auto space-y-3 pt-2">
        {isReady ? (
          <Link
            href="/dashboard/missions/new"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-[#4338CA] dark:bg-[#6366F1] text-white hover:opacity-95 transition-all font-semibold text-sm shadow-xs"
          >
            <Rocket className="w-4 h-4" />
            Khởi tạo Video đầu tiên / Launch First Mission
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          onNavigateToStep && (
            <button
              type="button"
              onClick={() => onNavigateToStep(2)}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-[#4338CA] dark:bg-[#6366F1] text-white hover:opacity-95 transition-all font-semibold text-sm shadow-xs"
            >
              <Key className="w-4 h-4" />
              Cấu hình khóa API / Configure API Keys
              <ArrowRight className="w-4 h-4" />
            </button>
          )
        )}
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 text-foreground hover:bg-muted/60 transition-colors text-xs font-semibold"
        >
          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
          Vào Dashboard / Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
