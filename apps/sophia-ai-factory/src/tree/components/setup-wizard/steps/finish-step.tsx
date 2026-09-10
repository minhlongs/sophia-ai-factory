"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Rocket,
  ShieldCheck,
  LayoutDashboard,
  Key,
  RefreshCw,
} from "lucide-react";
import { Link } from "@/navigation";
import type { AICapability } from "@/seed/ai/capability-model";

export interface ReadinessState {
  ownerVerified: boolean;
  byokEncrypted: boolean;
  providersConfigured: string[];
  providersReady: string[];
  subscriptionActive: boolean;
  tier: string;
  mcuBalance: number;
  capabilities: AICapability[];
  readyForMissions: boolean;
  issues: string[];
}

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
        className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ring-8 ${
          isReady
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/5"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/5"
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
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 ${
            isReady
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
          }`}
        >
          {isReady
            ? "Setup Complete / Cấu hình hoàn tất"
            : "Verification Notice / Cần hoàn thiện cấu hình"}
        </span>
        <h2 className="text-2xl font-bold text-foreground">
          {isReady
            ? "Sophia is Ready / Sophia đã sẵn sàng!"
            : "Configuration Incomplete / Cấu hình chưa đầy đủ"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          {isReady
            ? "Your AI Video Empire is verified and ready. Launch your first autonomous mission below."
            : "Some essential capabilities or provider credentials are still missing. Review the scorecard below."}
        </p>
      </div>

      {/* Dynamic Readiness Scorecard */}
      <div className="max-w-md mx-auto p-4 rounded-xl border border-border bg-card text-left space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Readiness Scorecard / Trạng thái hệ thống
          </h3>
          <button
            type="button"
            onClick={fetchReadiness}
            disabled={loading}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <RefreshCw
              className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Verifying server state... / Đang kiểm tra trạng thái...
          </div>
        ) : fetchError ? (
          <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive">
            {fetchError}
          </div>
        ) : readiness ? (
          <div className="space-y-2 text-xs divide-y divide-border/50">
            {/* Account Ownership */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-muted-foreground">Account Ownership:</span>
              {readiness.ownerVerified ? (
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  ✓ Verified Owner
                </span>
              ) : (
                <span className="font-semibold text-amber-600 flex items-center gap-1">
                  ⚠ Unverified Email
                </span>
              )}
            </div>

            {/* BYOK Providers */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-muted-foreground">BYOK AI Providers:</span>
              {readiness.byokEncrypted ? (
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  ✓ {readiness.providersConfigured.length} Provider(s) Encrypted
                </span>
              ) : (
                <span className="font-semibold text-rose-600 flex items-center gap-1">
                  ✕ No Keys Configured
                </span>
              )}
            </div>

            {/* Compute Allowance */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-muted-foreground">Compute Allowance:</span>
              {readiness.mcuBalance > 0 ? (
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  ✓ {readiness.mcuBalance} MCU Available ({readiness.tier})
                </span>
              ) : (
                <span className="font-semibold text-amber-600 flex items-center gap-1">
                  ⚠ 0 MCU Balance
                </span>
              )}
            </div>

            {/* Production Safety */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-muted-foreground">Production Safety:</span>
              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                ✓ Fail-Closed Guard Active
              </span>
            </div>

            {/* Available Capabilities */}
            <div className="pt-2">
              <div className="text-muted-foreground mb-1">
                Active AI Capabilities / Năng lực AI sẵn sàng:
              </div>
              {readiness.capabilities.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {readiness.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-semibold text-rose-600 text-[11px]">
                  ✕ None. Add provider keys to enable video/image generation.
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Error and Retry Section */}
      {saveFailed && (
        <div className="max-w-md mx-auto space-y-3">
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive text-left flex items-start gap-2">
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại / Retry Finalize
            </button>
          )}
        </div>
      )}

      {/* Action CTA */}
      <div className="max-w-md mx-auto space-y-3 pt-2">
        {isReady ? (
          <Link
            href="/dashboard/missions/new"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold text-sm shadow-md hover:shadow-lg"
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
              className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold text-sm shadow-md hover:shadow-lg"
            >
              <Key className="w-4 h-4" />
              Cấu hình khóa API / Configure API Keys
              <ArrowRight className="w-4 h-4" />
            </button>
          )
        )}
        <Link
          href="/dashboard"
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-xs font-medium"
        >
          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
          Vào Dashboard / Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
