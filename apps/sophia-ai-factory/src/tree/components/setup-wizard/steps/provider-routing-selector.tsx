// i18n-namespace: setupWizard.routingStrategy
"use client";

import React from 'react';
import { maskApiKey } from '@/tree/byok/provider-health-checker';
import type { ProviderConfig } from './provider-credentials-step';

export function SavedHint({ hint }: { hint: string | null }) {
  if (!hint) return null;
  return (
    <p className="font-mono text-xs text-emerald-700 dark:text-emerald-400 mt-1">
      Saved / Đã lưu: {maskApiKey(hint)} &nbsp;·&nbsp; Nhập giá trị mới để thay thế
    </p>
  );
}

export function ProviderRoutingStrategySelector({
  selectedStrategy,
  updateConfig,
  tRouting,
}: {
  selectedStrategy: ProviderConfig['ROUTING_STRATEGY'];
  updateConfig: (key: keyof ProviderConfig, value: string) => void;
  tRouting: (key: string) => string;
}) {
  return (
    <div className="space-y-2 pt-3 border-t border-border dark:border-white/[0.08]">
      <label className="text-xs font-semibold text-foreground block">
        {tRouting('label')} / Chiến lược điều phối AI
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {(['priority', 'costOptimized', 'leastUsed'] as const).map((strategy) => (
          <button
            key={strategy}
            type="button"
            onClick={() => updateConfig('ROUTING_STRATEGY', strategy)}
            className={`p-3 rounded-xl border text-left transition-all text-xs ${
              selectedStrategy === strategy
                ? 'border-[#4338CA] dark:border-[#6366F1] bg-[#4338CA]/10 dark:bg-[#6366F1]/15 font-semibold text-[#4338CA] dark:text-[#6366F1]'
                : 'border-border dark:border-white/[0.08] bg-[#F8F9FC] dark:bg-[#090A10]/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            <div>{tRouting(`${strategy}.label`)}</div>
            <div className="text-[10px] opacity-80 mt-0.5">{tRouting(`${strategy}.description`)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
