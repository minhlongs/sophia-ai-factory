'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound, Trash2, Wifi, Loader2, Edit2 } from 'lucide-react';
import { Button } from '@/seed/components/ui/button';
import type { Provider, ProviderInfo, TestResult } from './types';
import { PROVIDER_ICONS } from './types';
import { StatusBadge, type StatusBadgeType } from './status-badge';
import { KeyInputForm } from './key-input-form';
import type { validateProviderKey } from '@/tree/byok/key-format-validators';

interface ProviderCardProps {
  providerInfo: ProviderInfo;
  isConfigured: boolean;
  isEditing: boolean;
  isPending: boolean;
  keyValue: string;
  testResult: TestResult | null;
  testingProvider: Provider | null;
  validation: ReturnType<typeof validateProviderKey>;
  onInputChange: (val: string) => void;
  onToggleEditing: (isEditing: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onTest: (p: Provider) => void;
  onClear: (p: Provider) => void;
}

export function ProviderCard({
  providerInfo,
  isConfigured,
  isEditing,
  isPending,
  keyValue,
  testResult,
  testingProvider,
  validation,
  onInputChange,
  onToggleEditing,
  onSubmit,
  onTest,
  onClear,
}: ProviderCardProps) {
  const t = useTranslations('byok');
  const p = providerInfo.value;
  const Icon = PROVIDER_ICONS[p] || KeyRound;

  let badgeStatus: StatusBadgeType = 'not_configured';
  if (testingProvider === p) {
    badgeStatus = 'testing';
  } else if (isConfigured) {
    if (testResult && !testResult.ok) {
      badgeStatus = 'error';
    } else {
      badgeStatus = 'connected';
    }
  }

  return (
    <div className="bg-muted/10 border-border backdrop-blur-md rounded-xl p-5 flex flex-col justify-between gap-5 transition-all duration-300 hover:border-border hover:shadow-[0_0_15px_rgba(255,255,255,0.02)] min-h-[230px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-muted/20 border border-border/10 p-2 rounded-lg text-primary-400">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">{providerInfo.label}</h3>
            <p className="text-[11px] text-muted-foreground">API Connector</p>
          </div>
        </div>
        <StatusBadge status={badgeStatus} />
      </div>

      {isEditing ? (
        <KeyInputForm
          providerInfo={providerInfo}
          keyValue={keyValue}
          isPending={isPending}
          isConfigured={isConfigured}
          validation={validation}
          onInputChange={onInputChange}
          onSubmit={onSubmit}
          onCancel={() => onToggleEditing(false)}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-background/40 border border-border/10 rounded-lg px-3 py-2">
            <span className="text-sm font-mono text-muted-foreground select-none">••••••••••••</span>
            {testResult && (
              <span
                className={`text-xs font-semibold ${testResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}
                title={testResult.error}
              >
                {testResult.ok ? `✓ ${testResult.latencyMs}ms` : `✗ Error`}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onTest(p)}
              disabled={isPending || testingProvider === p}
              className="flex-1 text-blue-400 hover:text-blue-300"
            >
              {testingProvider === p ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              {t('test_button')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onToggleEditing(true)}
              disabled={isPending}
              className="flex-1 text-amber-400 hover:text-amber-300"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onClear(p)}
              disabled={isPending}
              className="text-rose-500 hover:text-rose-400"
              aria-label="Delete key"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
