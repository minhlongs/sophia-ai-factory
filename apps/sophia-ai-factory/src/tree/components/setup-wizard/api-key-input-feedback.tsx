"use client";

import React from 'react';
import { CheckCircle, XCircle, Loader2, Info } from 'lucide-react';

export interface ApiKeyHeaderBadgesProps {
  saved: boolean;
  value: string;
  helpText?: string;
}

export function ApiKeyHeaderBadges({ saved, value, helpText }: ApiKeyHeaderBadgesProps) {
  return (
    <div className="flex items-center gap-2">
      {saved && !value && (
        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Saved & Encrypted / Đã lưu & mã hóa
        </span>
      )}
      {helpText && (
        <div className="group relative">
          <Info className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help transition-colors" aria-hidden="true" />
          <div className="absolute right-0 bottom-6 w-64 p-2.5 bg-popover dark:bg-[#11131F] text-popover-foreground text-xs rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border dark:border-white/[0.08]">
            {helpText}
          </div>
        </div>
      )}
    </div>
  );
}

export interface ApiKeyStatusMessagesProps {
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  saved: boolean;
  value: string;
  latency: number | null;
  errorMessage?: string;
}

export function ApiKeyStatusMessages({
  status,
  saved,
  value,
  latency,
  errorMessage,
}: ApiKeyStatusMessagesProps) {
  return (
    <>
      {status === 'validating' && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 font-mono">
          <Loader2 className="w-3.5 h-3.5 text-primary motion-safe:animate-spin" />
          Verifying connection...
        </p>
      )}

      {status === 'valid' && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1.5 font-mono font-medium">
          <CheckCircle className="w-3.5 h-3.5" />
          Connection active {latency !== null ? `(${latency}ms)` : ''}
        </p>
      )}

      {saved && !value && status === 'idle' && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          Key active & encrypted at rest. Never displayed. / Khóa hoạt động & mã hóa bảo mật.
        </p>
      )}

      {status === 'invalid' && errorMessage && (
        <p className="text-xs text-destructive mt-1 flex items-center gap-1.5 font-medium">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          {errorMessage} {latency !== null ? `(took ${latency}ms)` : ''}
        </p>
      )}
    </>
  );
}
