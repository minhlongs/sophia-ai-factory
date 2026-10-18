"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  ReadinessScorecard,
  type ReadinessState,
} from "./readiness-scorecard";
import { FinishStepActions } from "./finish-step-actions";

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

      <FinishStepActions
        isReady={isReady}
        saveError={saveError}
        saveFailed={saveFailed}
        onRetry={onRetry}
        onNavigateToStep={onNavigateToStep}
      />
    </div>
  );
}
