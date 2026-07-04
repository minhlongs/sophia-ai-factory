"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper';
import type { ProviderConfig } from '@/tree/components/setup-wizard/steps/provider-credentials-step';

interface ReviewStepProps {
  config: {
    OPENROUTER_API_KEY: string;
    ANTHROPIC_API_KEY: string;
    ELEVENLABS_API_KEY: string;
    DID_API_KEY: string;
    MUAPI_API_KEY: string;
    REPLICATE_API_KEY: string;
  };
  providerConfig: {
    HEYGEN_API_KEY: string;
    RESEND_API_KEY: string;
    NOWPAYMENTS_API_KEY: string;
    HEYGEN_WEBHOOK_SECRET: string;
  };
  onConfirm: () => void;
  onBack: () => void;
  loading?: boolean;
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.slice(0, 4) + '•'.repeat(Math.min(key.length - 8, 12)) + key.slice(-4);
}

export function ReviewStep({ config, providerConfig, onConfirm, onBack, loading }: ReviewStepProps) {
  const t = useTranslations('setupWizard.review');

  const llmKeys = [
    { key: 'OPENROUTER_API_KEY' as const, label: t('keys.openrouter'), required: true },
    { key: 'ANTHROPIC_API_KEY' as const, label: t('keys.anthropic'), required: false },
  ].filter(k => config[k.key].trim().length > 0);

  const otherKeys = [
    { key: 'ELEVENLABS_API_KEY' as const, label: t('keys.elevenlabs'), required: true },
    { key: 'DID_API_KEY' as const, label: t('keys.did'), required: true },
    { key: 'MUAPI_API_KEY' as const, label: t('keys.muapi'), required: false },
    { key: 'REPLICATE_API_KEY' as const, label: t('keys.replicate'), required: false },
  ].filter(k => config[k.key].trim().length > 0);

  const providerKeyEntries = [
    { key: 'HEYGEN_API_KEY' as const, label: t('providers.heygen'), required: true },
    { key: 'HEYGEN_WEBHOOK_SECRET' as const, label: t('providers.heygenWebhook'), required: false },
    { key: 'RESEND_API_KEY' as const, label: t('providers.resend'), required: false },
    { key: 'NOWPAYMENTS_API_KEY' as const, label: t('providers.nowpayments'), required: false },
  ];

  const activeProviderKeys = providerKeyEntries.filter(k => providerConfig[k.key]?.trim().length > 0);

  const hasRequired = llmKeys.some(k => config[k.key].trim().length > 0) &&
    otherKeys.every(k => !k.required || config[k.key].trim().length > 0) &&
    providerKeyEntries.filter(k => k.required).every(k => providerConfig[k.key]?.trim().length > 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {!hasRequired && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">{t('missingRequired.title')}</p>
            <p className="mt-1 opacity-90">{t('missingRequired.description')}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* AI/LLM Keys */}
        {llmKeys.length > 0 && (
          <div className="rounded-lg border border-border p-4 bg-card">
            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🤖</span>
              {t('sections.llmKeys')}
            </h4>
            <ul className="space-y-3">
              {llmKeys.map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {maskApiKey(config[key])}
                    </span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Voice/Avatar Keys */}
        {otherKeys.length > 0 && (
          <div className="rounded-lg border border-border p-4 bg-card">
            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🎙️</span>
              {t('sections.mediaKeys')}
            </h4>
            <ul className="space-y-3">
              {otherKeys.map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {maskApiKey(config[key])}
                    </span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Provider Keys */}
        {activeProviderKeys.length > 0 && (
          <div className="rounded-lg border border-border p-4 bg-card md:col-span-2">
            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <span className="text-lg">🔗</span>
              {t('sections.providerKeys')}
            </h4>
            <ul className="space-y-3">
              {activeProviderKeys.map(({ key, label }) => (
                <li key={key} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {maskApiKey(providerConfig[key])}
                    </span>
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 text-sm text-accent flex gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>{t('securityNote')}</p>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground font-medium px-4 py-2 transition-colors"
        >
          {t('actions.back')}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !hasRequired}
          className={cn(
            "bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-all duration-200",
            (!hasRequired || loading) && "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {t('actions.confirm')}
            </>
          ) : (
            <>
              {t('actions.confirm')}
              <Check className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
