"use client";

import React, { useState } from 'react';
import { cn } from './wizard-stepper';
import { ApiKeyHeaderBadges, ApiKeyStatusMessages } from './api-key-input-feedback';
import { ApiKeyInputControls } from './api-key-input-controls';

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

        <ApiKeyInputControls
          showPassword={showPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          status={status}
          saved={saved}
          value={value}
          latency={latency}
          onRevoke={onRevoke}
          isRevoking={isRevoking}
          onVerify={handleVerify}
        />
      </div>

      <ApiKeyStatusMessages status={status} saved={saved} value={value} latency={latency} errorMessage={errorMessage} />
    </div>
  );
}
