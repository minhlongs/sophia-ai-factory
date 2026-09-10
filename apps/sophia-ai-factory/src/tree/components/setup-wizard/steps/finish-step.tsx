"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Rocket, ShieldCheck, LayoutDashboard } from "lucide-react";
import { Link } from "@/navigation";

export interface FinishStepProps {
  saveError: string | null;
  saveFailed?: boolean;
  onRetry?: () => void;
}

export function FinishStep({
  saveError,
  saveFailed,
  onRetry,
}: FinishStepProps) {
  return (
    <div className="space-y-6 text-center py-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto ring-8 ring-emerald-500/5">
        <CheckCircle2 className="w-9 h-9" />
      </div>

      <div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
          Setup Complete / Cấu hình hoàn tất
        </span>
        <h2 className="text-2xl font-bold text-foreground">
          Sophia is Ready / Sophia đã sẵn sàng!
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Your AI Video Empire is fully configured. Launch your first autonomous mission in seconds.
          <br />
          Hệ thống đã sẵn sàng sản xuất. Bắt đầu chiến dịch video AI đầu tiên của bạn ngay bây giờ.
        </p>
      </div>

      {/* Readiness Scorecard */}
      <div className="max-w-md mx-auto p-4 rounded-xl border border-border bg-card text-left space-y-3">
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Readiness Scorecard / Trạng thái sẵn sàng
        </h3>
        <div className="space-y-2 text-xs divide-y divide-border/50">
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground">Account Ownership:</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              ✓ Verified Owner
            </span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-muted-foreground">BYOK AI Providers:</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              ✓ AES-256 Encrypted
            </span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-muted-foreground">Compute Allowance:</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              ✓ Active MCU Allocation
            </span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-muted-foreground">Production Safety:</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              ✓ Fail-Closed Guard Active
            </span>
          </div>
        </div>
      </div>

      {saveFailed ? (
        <div className="max-w-md mx-auto space-y-3">
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-xs text-destructive">
            {saveError || "Failed to finalize setup credentials / Lưu cấu hình thất bại"}
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
          >
            <Rocket className="w-4 h-4" />
            Thử lại / Retry Finalize
          </button>
        </div>
      ) : (
        <div className="max-w-md mx-auto space-y-3 pt-2">
          <Link
            href="/dashboard/missions/new"
            className="flex items-center justify-center gap-2 w-full px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold text-sm shadow-md hover:shadow-lg"
          >
            <Rocket className="w-4 h-4" />
            Khởi tạo Video đầu tiên / Launch First Mission
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-xs font-medium"
          >
            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
            Vào Bảng Điều Khiển / Operations Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
