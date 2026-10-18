'use client';

import React from 'react';
import { KeyRound } from 'lucide-react';
import type { Provider, ProviderInfo, TestResult } from './types';
import { PROVIDER_ICONS } from './types';
import { StatusBadge, type StatusBadgeType } from './status-badge';
import { KeyInputForm } from './key-input-form';
import { ProviderCardActions } from './provider-card-actions';
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
        <ProviderCardActions
          provider={p}
          isPending={isPending}
          testResult={testResult}
          testingProvider={testingProvider}
          onTest={onTest}
          onToggleEditing={onToggleEditing}
          onClear={onClear}
        />
      )}
    </div>
  );
}
