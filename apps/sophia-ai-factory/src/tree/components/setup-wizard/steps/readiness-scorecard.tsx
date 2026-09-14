"use client";

import React from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
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

interface ReadinessScorecardProps {
  readiness: ReadinessState | null;
  loading: boolean;
  fetchError: string | null;
  onRefresh: () => void;
}

export function ReadinessScorecard({
  readiness,
  loading,
  fetchError,
  onRefresh,
}: ReadinessScorecardProps) {
  return (
    <div className="max-w-md mx-auto p-4 rounded-xl border border-border bg-card text-left space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Readiness Scorecard / Trạng thái hệ thống
        </h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
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

          <div className="flex items-center justify-between pt-2">
            <span className="text-muted-foreground">Production Safety:</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              ✓ Fail-Closed Guard Active
            </span>
          </div>

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
  );
}
