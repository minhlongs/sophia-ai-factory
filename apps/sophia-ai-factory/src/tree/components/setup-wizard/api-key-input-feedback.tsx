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
        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Saved & Encrypted / Đã lưu & mã hóa
        </span>
      )}
      {helpText && (
        <div className="group relative">
          <Info className="w-4 h-4 text-muted-foreground cursor-help" aria-hidden="true" />
          <div className="absolute right-0 bottom-6 w-64 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border">
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
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 className="w-3.5 h-3.5 text-primary motion-safe:animate-spin" />
          Verifying connection...
        </p>
      )}

      {status === 'valid' && (
        <p className="text-xs text-primary mt-1 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          Connection active {latency !== null ? `(${latency}ms)` : ''}
        </p>
      )}

      {saved && !value && status === 'idle' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          Key active & encrypted at rest. Never displayed. / Khóa hoạt động & mã hóa bảo mật.
        </p>
      )}

      {status === 'invalid' && errorMessage && (
        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" />
          {errorMessage} {latency !== null ? `(took ${latency}ms)` : ''}
        </p>
      )}
    </>
  );
}
