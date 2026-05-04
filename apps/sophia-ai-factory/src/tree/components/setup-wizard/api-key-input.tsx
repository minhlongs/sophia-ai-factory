"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper'; // Reuse cn utility

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
  required
}: ApiKeyInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="block text-sm font-medium text-foreground">
          {label} {required && <span className="text-destructive">*</span>}
        </label>
        {helpText && (
          <div className="group relative">
            <Info className="w-4 h-4 text-muted-foreground cursor-help" />
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
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full px-4 py-2 pr-24 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none transition-colors bg-background text-foreground",
            status === 'invalid' ? "border-destructive focus:ring-destructive/20" :
            status === 'valid' ? "border-green-500 focus:ring-green-500/20" :
            "border-input"
          )}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-20 text-muted-foreground hover:text-foreground p-1"
          aria-label={showPassword ? 'Hide API key' : 'Show API key'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>

        <div className="absolute right-2 flex items-center gap-2">
          {status === 'validating' && <Loader2 className="w-5 h-5 text-primary motion-safe:animate-spin" />}
          {status === 'valid' && <CheckCircle className="w-5 h-5 text-green-500" />}
          {status === 'invalid' && <XCircle className="w-5 h-5 text-destructive" />}

          <button
            type="button"
            onClick={onVerify}
            disabled={status === 'validating' || !value}
            className="text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground px-2 py-1 rounded disabled:opacity-50"
          >
            Verify
          </button>
        </div>
      </div>

      {status === 'invalid' && errorMessage && (
        <p className="text-xs text-destructive mt-1">{errorMessage}</p>
      )}
    </div>
  );
}
