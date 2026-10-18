"use client";

import React from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export interface ApiKeyInputControlsProps {
  showPassword: boolean;
  onTogglePassword: () => void;
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  saved: boolean;
  value: string;
  latency: number | null;
  onRevoke?: () => Promise<void> | void;
  isRevoking: boolean;
  onVerify: () => Promise<void>;
}

export function ApiKeyInputControls({
  showPassword,
  onTogglePassword,
  status,
  saved,
  value,
  latency,
  onRevoke,
  isRevoking,
  onVerify,
}: ApiKeyInputControlsProps) {
  return (
    <div className="absolute right-2 flex items-center gap-1.5">
      <button
        type="button"
        onClick={onTogglePassword}
        className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/60 transition-all duration-100 active:scale-95"
        aria-label={showPassword ? 'Hide API key' : 'Show API key'}
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      {status === 'validating' && (
        <Loader2 className="w-4 h-4 text-primary motion-safe:animate-spin transition-all duration-300" aria-hidden="true" />
      )}

      {(status === 'valid' || (saved && !value)) && (
        <div className="flex items-center gap-1 transition-all duration-300">
          {latency !== null && (
            <span className="inline-flex items-center font-mono text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-1.5 py-0.5 rounded transition-all duration-300">
              ✓ {latency}ms
            </span>
          )}
          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 transition-all duration-300" aria-hidden="true" />
        </div>
      )}

      {status === 'invalid' && (
        <XCircle className="w-4 h-4 text-destructive transition-all duration-300" aria-hidden="true" />
      )}

      {saved && !value && onRevoke ? (
        <button
          type="button"
          onClick={onRevoke}
          disabled={isRevoking}
          className="text-[11px] font-semibold text-destructive hover:bg-destructive/10 px-2.5 py-1 rounded-md border border-destructive/30 disabled:opacity-50 transition-all duration-100 active:scale-95"
        >
          {isRevoking ? 'Revoking...' : 'Revoke'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onVerify}
          disabled={status === 'validating' || !value}
          className="text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-[#4338CA] dark:text-[#6366F1] border border-primary/20 px-2.5 py-1 rounded-md disabled:opacity-40 transition-all duration-100 active:scale-95"
        >
          Verify
        </button>
      )}
    </div>
  );
}
