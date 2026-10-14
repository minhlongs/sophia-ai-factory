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
    <div className={`rounded-lg border border-border p-4 bg-card ${className ?? ''}`}>
      <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        {title}
      </h4>
      <ul className="space-y-3">
        {keys.map(({ key, label, value }) => (
          <li key={key} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {maskApiKey(value)}
              </span>
              <Check className="w-4 h-4 text-green-500" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
