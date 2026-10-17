"use client";

import React from 'react';
import { Check } from 'lucide-react';
import { maskApiKey } from './review-types';

interface KeySectionProps {
  icon: string;
  title: string;
  keys: { key: string; label: string; value: string }[];
  className?: string;
}

export function KeySection({ icon, title, keys, className }: KeySectionProps) {
  if (keys.length === 0) return null;
  return (
    <div className={`rounded-xl border border-border dark:border-white/[0.08] p-4 bg-[#F8F9FC] dark:bg-[#090A10]/60 ${className ?? ''}`}>
      <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
        <span className="text-base">{icon}</span>
        {title}
      </h4>
      <ul className="space-y-2.5">
        {keys.map(({ key, label, value }) => (
          <li key={key} className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08] text-foreground px-2.5 py-1 rounded-md">
                {maskApiKey(value)}
              </span>
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
