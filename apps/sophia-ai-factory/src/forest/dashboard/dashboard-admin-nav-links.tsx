"use client";

import React from "react";
import { Link } from "@/navigation";
import { cn } from "@/seed/utils/cn";
import { ShieldCheck, Activity, KeyRound } from "lucide-react";

export interface DashboardAdminNavLinksProps {
  isVi: boolean;
  isActive: (href: string) => boolean;
  onCloseMobile?: () => void;
}

export function DashboardAdminNavLinks({
  isVi,
  isActive,
  onCloseMobile,
}: DashboardAdminNavLinksProps) {
  return (
    <div className="pt-3 mt-3 border-t border-border/50">
      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
        {isVi ? "Bảng Quản Trị" : "Admin Console"}
      </div>
      <Link
        href="/admin/handover"
        onClick={onCloseMobile}
        className={cn(
          "relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-muted/60 transition-all",
          isActive("/admin/handover") && "text-white bg-primary/10 border border-primary/30 font-medium"
        )}
      >
        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="truncate">Handover Console</span>
      </Link>
      <Link
        href="/dashboard/admin/ops"
        onClick={onCloseMobile}
        className={cn(
          "relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-muted/60 transition-all",
          isActive("/dashboard/admin/ops") && "text-white bg-primary/10 border border-primary/30 font-medium"
        )}
      >
        <Activity className="w-4 h-4 text-primary shrink-0" />
        <span className="truncate">Ops Dashboard</span>
      </Link>
      <Link
        href="/dashboard/admin/byok-rotation"
        onClick={onCloseMobile}
        className={cn(
          "relative flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-muted-foreground hover:text-white hover:bg-muted/60 transition-all",
          isActive("/dashboard/admin/byok-rotation") && "text-white bg-primary/10 border border-primary/30 font-medium"
        )}
      >
        <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="truncate">{isVi ? "Xoay Vòng Khóa" : "Key Rotation"}</span>
      </Link>
    </div>
  );
}
