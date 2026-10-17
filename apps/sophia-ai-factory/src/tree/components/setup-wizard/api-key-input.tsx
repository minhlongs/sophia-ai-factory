"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from './wizard-stepper';
import { ApiKeyHeaderBadges, ApiKeyStatusMessages } from './api-key-input-feedback';

interface ApiKeyInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onVerify: () => Promise<unknown>;
  placeholder?: string;
  helpText?: string;
  status: 'idle' | 'validating' | 'valid' | 'invalid';
  errorMessage?: string;
  required?: boolean;
  latency?: number;
  saved?: boolean;
  onRevoke?: () => Promise<void> | void;
  isRevoking?: boolean;
}

export function ApiKeyInput({
  id,
  label,
  value,
  onChange,
  onVerify,
  placeholder,
  helpText,
  status,
  errorMessage,
  required,
  latency: latencyProp,
  saved = false,
  onRevoke,
  isRevoking = false,
}: ApiKeyInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [internalLatency, setInternalLatency] = useState<number | null>(null);

  const latency = status === 'idle' ? null : (latencyProp !== undefined ? latencyProp : internalLatency);

  const handleVerify = async () => {
    const start = performance.now();
    try {
      await onVerify();
    } catch {
      // Ignored: parent is expected to handle error and update status/errorMessage props
    } finally {
      const end = performance.now();
      setInternalLatency(Math.round(end - start));
    }
  };

  const handleTextChange = (val: string) => {
    setInternalLatency(null);
    onChange(val);
  };

  return (
    <div className="w-full space-y-2 text-left rounded-xl border border-border dark:border-white/[0.08] bg-card dark:bg-[#11131F] p-3.5 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-sm font-semibold text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        <ApiKeyHeaderBadges saved={saved} value={value} helpText={helpText} />
      </div>

      <div className="relative flex items-center">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={saved && !value ? '•••••••••••••••• (Saved / Đã lưu an toàn)' : placeholder}
          className={cn(
            "w-full px-3.5 py-2 pr-44 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary/25 focus:border-primary focus:outline-none transition-all duration-200 bg-[#F8F9FC] dark:bg-[#090A10] text-foreground placeholder:font-sans placeholder:text-muted-foreground/70",
            status === 'invalid' ? "border-destructive focus:ring-destructive/20" :
            (status === 'valid' || (saved && !value)) ? "border-emerald-500/50 dark:border-emerald-500/40 focus:ring-emerald-500/20" :
            "border-border dark:border-white/[0.08]"
          )}
        />

        <div className="absolute right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
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
              onClick={handleVerify}
              disabled={status === 'validating' || !value}
              className="text-[11px] font-semibold bg-primary/10 hover:bg-primary/20 text-[#4338CA] dark:text-[#6366F1] border border-primary/20 px-2.5 py-1 rounded-md disabled:opacity-40 transition-all duration-100 active:scale-95"
            >
              Verify
            </button>
          )}
        </div>
      </div>

      <ApiKeyStatusMessages status={status} saved={saved} value={value} latency={latency} errorMessage={errorMessage} />
    </div>
  );
}
