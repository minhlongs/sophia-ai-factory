'use client';

import React from 'react';

export interface RegisterInputFieldProps {
  id: string;
  type: 'text' | 'email' | 'password';
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export function RegisterInputField({
  id,
  type,
  label,
  placeholder,
  value,
  onChange,
  required = false,
  icon: Icon,
}: RegisterInputFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#090A10] border border-[#E2E8F0] dark:border-white/10 text-[#0B0F19] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#4338CA]/40 dark:focus:ring-indigo-500/40 focus:border-[#4338CA] dark:focus:border-indigo-500 transition-all"
        />
      </div>
    </div>
  );
}
