"use client";

/**
 * Provider Credentials Step — Setup wizard step for HeyGen, Resend, NOWPayments.
 * Bilingual: Vietnamese + English. File size < 200 lines.
 *
 * @module tree/components/setup-wizard/steps/provider-credentials-step
 */

import React from 'react';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip';
import { useTranslations } from 'next-intl';
import { maskApiKey } from '@/tree/byok/provider-health-checker';
import type { CredentialSummary } from '@/tree/credentials/user-credentials-repo';

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

function SavedHint({ hint }: { hint: string | null }) {
  if (!hint) return null;
  return (
    <p className="text-xs text-emerald-600 mt-1">
      Saved / Đã lưu: {maskApiKey(hint)} &nbsp;·&nbsp; Nhập giá trị mới để thay thế
    </p>
  );
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
        <h2 className="text-xl font-semibold text-foreground">
          Provider Keys / Khóa nhà cung cấp
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure video rendering and transaction providers under your own accounts.
          <br />
          Cấu hình nhà cung cấp video và giao dịch chạy trực tiếp dưới tài khoản của bạn.
        </p>
      </div>

      {/* HeyGen */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
            Avatar Video Engine / Khuyến nghị
          </span>
        </div>
        <ApiKeyInput
          id="heygen"
          label="HeyGen API Key"
          value={config.HEYGEN_API_KEY}
          onChange={(v) => updateConfig('HEYGEN_API_KEY', v)}
          onVerify={() => onTestKey('heygen', 'HEYGEN_API_KEY', config.HEYGEN_API_KEY)}
          status={status.HEYGEN_API_KEY ?? 'idle'}
          errorMessage={errors.HEYGEN_API_KEY}
          placeholder="e.g. hk_..."
          helpText="Your HeyGen API key for avatar synthesis. Get it from app.heygen.com → Settings."
          latency={latencies?.HEYGEN_API_KEY}
        />
        <SavedHint hint={getSaved('heygen')} />
      </div>

      {/* Resend */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
            Optional / Tùy chọn
          </span>
        </div>
        <ApiKeyInput
          id="resend"
          label="Resend API Key"
          value={config.RESEND_API_KEY}
          onChange={(v) => updateConfig('RESEND_API_KEY', v)}
          onVerify={() => onTestKey('resend', 'RESEND_API_KEY', config.RESEND_API_KEY)}
          status={status.RESEND_API_KEY ?? 'idle'}
          errorMessage={errors.RESEND_API_KEY}
          placeholder="re_..."
          helpText="Key for transactional email notifications. Falls back to platform default if empty."
          latency={latencies?.RESEND_API_KEY}
        />
        <SavedHint hint={getSaved('resend')} />
      </div>

      {/* NOWPayments */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
            Crypto Billing (Optional / Tùy chọn)
          </span>
        </div>
        <ApiKeyInput
          id="nowpayments"
          label="NOWPayments API Key"
          value={config.NOWPAYMENTS_API_KEY}
          onChange={(v) => updateConfig('NOWPAYMENTS_API_KEY', v)}
          onVerify={() => onTestKey('nowpayments', 'NOWPAYMENTS_API_KEY', config.NOWPAYMENTS_API_KEY)}
          status={status.NOWPAYMENTS_API_KEY ?? 'idle'}
          errorMessage={errors.NOWPAYMENTS_API_KEY}
          placeholder="NOWPayments API key..."
          helpText="Optional: Only required if you operate an isolated merchant account."
          latency={latencies?.NOWPAYMENTS_API_KEY}
        />
        <ByokHelpTip provider="nowpayments" />
        <SavedHint hint={getSaved('nowpayments')} />
      </div>

      {/* Routing Strategy */}
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
                config.ROUTING_STRATEGY === strategy
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

      <div className="flex justify-between items-center pt-4 border-t border-border">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-foreground font-medium px-4 py-2"
          >
            Quay lại / Back
          </button>
        ) : <div />}
        <button
          type="button"
          onClick={onNext}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
        >
          {actions('next')}
        </button>
      </div>
    </div>
  );
}
