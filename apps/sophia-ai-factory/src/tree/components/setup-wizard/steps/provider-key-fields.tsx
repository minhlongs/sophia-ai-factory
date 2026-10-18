"use client";

/**
 * Provider Key Input Fields — HeyGen, Resend, NOWPayments key blocks for Setup Wizard.
 *
 * @module tree/components/setup-wizard/steps/provider-key-fields
 */

import React from 'react';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip';
import { SavedHint } from './provider-routing-selector';
import type { ProviderConfig } from './provider-credentials-step';

export interface ProviderKeyFieldsProps {
  config: ProviderConfig;
  updateConfig: (key: keyof ProviderConfig, value: string) => void;
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>;
  errors: Record<string, string>;
  onTestKey: (provider: string, fieldKey: keyof ProviderConfig, value: string) => Promise<boolean>;
  getSaved: (provider: string) => string | null;
  latencies?: Record<string, number>;
}

export function ProviderKeyFields({
  config,
  updateConfig,
  status,
  errors,
  onTestKey,
  getSaved,
  latencies,
}: ProviderKeyFieldsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#4338CA]/10 dark:bg-[#6366F1]/15 border border-[#4338CA]/20 dark:border-[#6366F1]/25 text-[#4338CA] dark:text-[#6366F1]">
            Avatar Video Engine / Khuyến nghị
          </span>
        </div>
        <ApiKeyInput
          id="heygen" label="HeyGen API Key" value={config.HEYGEN_API_KEY}
          onChange={(v) => updateConfig('HEYGEN_API_KEY', v)}
          onVerify={() => onTestKey('heygen', 'HEYGEN_API_KEY', config.HEYGEN_API_KEY)}
          status={status.HEYGEN_API_KEY ?? 'idle'} errorMessage={errors.HEYGEN_API_KEY}
          placeholder="e.g. hk_..."
          helpText="Your HeyGen API key for avatar synthesis. Get it from app.heygen.com → Settings."
          latency={latencies?.HEYGEN_API_KEY}
        />
        <SavedHint hint={getSaved('heygen')} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted border border-border dark:border-white/[0.08] text-muted-foreground">
            Optional / Tùy chọn
          </span>
        </div>
        <ApiKeyInput
          id="resend" label="Resend API Key" value={config.RESEND_API_KEY}
          onChange={(v) => updateConfig('RESEND_API_KEY', v)}
          onVerify={() => onTestKey('resend', 'RESEND_API_KEY', config.RESEND_API_KEY)}
          status={status.RESEND_API_KEY ?? 'idle'} errorMessage={errors.RESEND_API_KEY}
          placeholder="re_..."
          helpText="Key for transactional email notifications. Falls back to platform default if empty."
          latency={latencies?.RESEND_API_KEY}
        />
        <SavedHint hint={getSaved('resend')} />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted border border-border dark:border-white/[0.08] text-muted-foreground">
            Crypto Billing (Optional / Tùy chọn)
          </span>
        </div>
        <ApiKeyInput
          id="nowpayments" label="NOWPayments API Key" value={config.NOWPAYMENTS_API_KEY}
          onChange={(v) => updateConfig('NOWPAYMENTS_API_KEY', v)}
          onVerify={() => onTestKey('nowpayments', 'NOWPAYMENTS_API_KEY', config.NOWPAYMENTS_API_KEY)}
          status={status.NOWPAYMENTS_API_KEY ?? 'idle'} errorMessage={errors.NOWPAYMENTS_API_KEY}
          placeholder="NOWPayments API key..."
          helpText="Optional: Only required if you operate an isolated merchant account."
          latency={latencies?.NOWPAYMENTS_API_KEY}
        />
        <ByokHelpTip provider="nowpayments" />
        <SavedHint hint={getSaved('nowpayments')} />
      </div>
    </>
  );
}
