"use client";

import React, { useState } from 'react';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2, Info } from 'lucide-react';
import { cn } from './wizard-stepper'; // Reuse cn utility

interface ApiKeyInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onVerify: () => Promise<void>;
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
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {helpText && (
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute right-0 bottom-6 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
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
            "w-full px-4 py-2 pr-24 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors",
            status === 'invalid' ? "border-red-300 focus:ring-red-200" :
            status === 'valid' ? "border-green-300 focus:ring-green-200" :
            "border-gray-300"
          )}
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-20 text-gray-400 hover:text-gray-600 p-1"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>

        <div className="absolute right-2 flex items-center gap-2">
          {status === 'validating' && <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />}
          {status === 'valid' && <CheckCircle className="w-5 h-5 text-green-500" />}
          {status === 'invalid' && <XCircle className="w-5 h-5 text-red-500" />}

          <button
            type="button"
            onClick={onVerify}
            disabled={status === 'validating' || !value}
            className="text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded disabled:opacity-50"
          >
            Verify
          </button>
        </div>
      </div>

      {status === 'invalid' && errorMessage && (
        <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
      )}
    </div>
  );
}
