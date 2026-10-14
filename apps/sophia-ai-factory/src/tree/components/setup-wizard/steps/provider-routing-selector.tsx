// i18n-namespace: setupWizard.routingStrategy
"use client";

import React from 'react';
import { maskApiKey } from '@/tree/byok/provider-health-checker';
import type { ProviderConfig } from './provider-credentials-step';

export function SavedHint({ hint }: { hint: string | null }) {
  if (!hint) return null;
  return (
    <p className="text-xs text-emerald-600 mt-1">
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
    <div className="space-y-2 pt-2 border-t border-border/50">
      <label className="text-xs font-semibold text-foreground block">
        {tRouting('label')} / Chiến lược điều phối AI
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {(['priority', 'costOptimized', 'leastUsed'] as const).map((strategy) => (
          <button
            key={strategy}
            type="button"
            onClick={() => updateConfig('ROUTING_STRATEGY', strategy)}
            className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
              selectedStrategy === strategy
                ? 'border-primary bg-primary/5 font-semibold text-primary'
                : 'border-border text-muted-foreground hover:border-border/80'
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
