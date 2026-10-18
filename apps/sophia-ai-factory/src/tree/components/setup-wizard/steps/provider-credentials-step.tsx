"use client";

/**
 * Provider Credentials Step — Setup wizard step for HeyGen, Resend, NOWPayments.
 * Bilingual: Vietnamese + English. File size < 130 lines.
 *
 * @module tree/components/setup-wizard/steps/provider-credentials-step
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import type { CredentialSummary } from '@/tree/credentials/user-credentials-repo';
import { ProviderRoutingStrategySelector } from './provider-routing-selector';
import { ProviderKeyFields } from './provider-key-fields';

export interface ProviderConfig {
  HEYGEN_API_KEY: string;
  RESEND_API_KEY: string;
  NOWPAYMENTS_API_KEY: string;
  HEYGEN_WEBHOOK_SECRET: string;
  ROUTING_STRATEGY: 'priority' | 'costOptimized' | 'leastUsed';
}

interface ProviderCredentialsStepProps {
  config: ProviderConfig;
  updateConfig: (key: keyof ProviderConfig, value: string) => void;
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>;
  errors: Record<string, string>;
  onTestKey: (provider: string, fieldKey: keyof ProviderConfig, value: string) => Promise<boolean>;
  savedCredentials: CredentialSummary[];
  latencies?: Record<string, number>;
  onNext: () => void;
  onBack?: () => void;
}

export function ProviderCredentialsStep({
  config,
  updateConfig,
  status,
  errors,
  onTestKey,
  savedCredentials,
  latencies,
  onNext,
  onBack,
}: ProviderCredentialsStepProps) {
  const tRouting = useTranslations('setupWizard.routingStrategy');
  const actions = useTranslations('setupWizard.actions');
  const getSaved = (provider: string) =>
    savedCredentials.find((c) => c.provider === provider)?.display_hint ?? null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          Provider Keys / Khóa nhà cung cấp
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure video rendering and transaction providers under your own accounts.
          <br />
          Cấu hình nhà cung cấp video và giao dịch chạy trực tiếp dưới tài khoản của bạn.
        </p>
      </div>

      <ProviderKeyFields
        config={config}
        updateConfig={updateConfig}
        status={status}
        errors={errors}
        onTestKey={onTestKey}
        getSaved={getSaved}
        latencies={latencies}
      />

      <ProviderRoutingStrategySelector
        selectedStrategy={config.ROUTING_STRATEGY}
        updateConfig={updateConfig}
        tRouting={(k) => tRouting(k)}
      />

      <div className="flex justify-between items-center pt-4 border-t border-border dark:border-white/[0.08]">
        {onBack ? (
          <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2 transition-colors">
            Quay lại / Back
          </button>
        ) : <div />}
        <button type="button" onClick={onNext} className="rounded-lg bg-[#4338CA] dark:bg-[#6366F1] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-95 transition-all shadow-xs">
          {actions('next')}
        </button>
      </div>
    </div>
  );
}
