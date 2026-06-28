"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { cn } from './wizard-stepper'; // Reuse cn utility

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
  latency: latencyProp
}: ApiKeyInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [internalLatency, setInternalLatency] = useState<number | null>(null);

  // Derived latency: reset automatically when status is idle, otherwise use prop or internal
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
    <div className="w-full space-y-2 text-left">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {helpText && (
          <div className="group relative">
            <Info className="w-4 h-4 text-muted-foreground cursor-help" aria-hidden="true" />
            <div className="absolute right-0 bottom-6 w-64 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-border">
              {helpText}
            </div>
          </div>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full px-4 py-2 pr-40 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none transition-all duration-200 bg-background text-foreground",
            status === 'invalid' ? "border-destructive focus:ring-destructive/20" :
            status === 'valid' ? "border-primary/50 focus:ring-primary/20" :
            "border-input"
          )}
        />

        <div className="absolute right-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted-foreground hover:text-foreground p-1 transition-all duration-100 active:scale-95"
            aria-label={showPassword ? 'Hide API key' : 'Show API key'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          {status === 'validating' && (
            <Loader2 className="w-4 h-4 text-primary motion-safe:animate-spin transition-all duration-300" aria-hidden="true" />
          )}
          
          {status === 'valid' && (
            <div className="flex items-center gap-1 transition-all duration-300">
              {latency !== null && (
                <span className="inline-flex items-center text-[10px] font-bold bg-primary/15 text-primary border border-primary/20 px-1.5 py-0.5 rounded transition-all duration-300">
                  ✓ {latency}ms
                </span>
              )}
              <CheckCircle className="w-4 h-4 text-green-500 transition-all duration-300" aria-hidden="true" />
            </div>
          )}

          {status === 'invalid' && (
            <XCircle className="w-4 h-4 text-destructive transition-all duration-300" aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={handleVerify}
            disabled={status === 'validating' || !value}
            className="text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground px-2 py-0.5 rounded disabled:opacity-50 transition-all duration-100 active:scale-95"
          >
            Verify
          </button>
        </div>
      </div>

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

      {status === 'invalid' && errorMessage && (
        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" />
          {errorMessage} {latency !== null ? `(took ${latency}ms)` : ''}
        </p>
      )}
    </div>
  );
}
