'use client';

import React from "react";
import { Link } from "@/navigation";
import { Film, Sparkles } from "lucide-react";

export interface ActivityTableEmptyProps {
  emptyTitle: string;
  emptyDesc: string;
  buttonLabel: string;
}

export function ActivityTableEmpty({
  emptyTitle,
  emptyDesc,
  buttonLabel,
}: ActivityTableEmptyProps) {
  return (
    <div className="py-14 px-6 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-full bg-muted dark:bg-white/[0.04] border border-border dark:border-white/[0.08] flex items-center justify-center text-muted-foreground mb-3">
        <Film className="w-6 h-6 text-primary/70" />
      </div>
      <p className="text-sm font-semibold text-foreground dark:text-white mb-1">
        {emptyTitle}
      </p>
      <p className="text-xs text-muted-foreground max-w-sm mb-5">
        {emptyDesc}
      </p>
      <Link
        href="/dashboard/missions/new"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>{buttonLabel}</span>
      </Link>
    </div>
  );
}
