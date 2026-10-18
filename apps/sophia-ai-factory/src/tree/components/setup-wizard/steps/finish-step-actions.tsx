"use client";

import React from "react";
import {
  ArrowRight,
  XCircle,
  Rocket,
  LayoutDashboard,
  Key,
  RefreshCw,
} from "lucide-react";
import { Link } from "@/navigation";

export interface FinishStepActionsProps {
  isReady: boolean;
  saveError: string | null;
  saveFailed?: boolean;
  onRetry?: () => void;
  onNavigateToStep?: (stepIndex: number) => void;
}

export function FinishStepActions({
  isReady,
  saveError,
  saveFailed,
  onRetry,
  onNavigateToStep,
}: FinishStepActionsProps) {
  return (
    <>
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
    </>
  );
}
