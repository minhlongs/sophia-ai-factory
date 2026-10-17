"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { Check, AlertTriangle, Route } from 'lucide-react';
import { cn } from '@/tree/components/setup-wizard/wizard-stepper';
import type { ReviewStepProps } from './review/review-types';
import { KeySection } from './review/key-section';

export type { ReviewStepProps } from './review/review-types';

export function ReviewStep({ config, providerConfig, onConfirm, onBack, loading }: ReviewStepProps) {
  const t = useTranslations('setupWizard.review');

  const routingStrategyLabels: Record<string, string> = {
    priority: t('routingStrategy.priority.label'),
    costOptimized: t('routingStrategy.costOptimized.label'),
    leastUsed: t('routingStrategy.leastUsed.label'),
  };

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
        <h2 className="text-xl font-bold text-foreground tracking-tight">{t('title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {!hasRequired && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#D97706]/40 dark:border-[#F59E0B]/40 bg-[#D97706]/10 dark:bg-[#F59E0B]/10 p-4 text-sm text-[#D97706] dark:text-[#F59E0B]">
          <AlertTriangle className="mt-0.5 w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">{t('missingRequired.title')}</p>
            <p className="mt-1 opacity-90">{t('missingRequired.description')}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <KeySection
          icon="🤖"
          title={t('sections.llmKeys')}
          keys={llmKeys.map(k => ({ key: k.key, label: k.label, value: config[k.key] }))}
        />
        <KeySection
          icon="🎙️"
          title={t('sections.mediaKeys')}
          keys={otherKeys.map(k => ({ key: k.key, label: k.label, value: config[k.key] }))}
        />
        <KeySection
          icon="🔗"
          title={t('sections.providerKeys')}
          keys={activeProviderKeys.map(k => ({ key: k.key, label: k.label, value: providerConfig[k.key] }))}
          className="md:col-span-2"
        />

        <div className="rounded-xl border border-border dark:border-white/[0.08] p-4 bg-[#F8F9FC] dark:bg-[#090A10]/60 md:col-span-2">
          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2 text-sm">
            <Route className="w-4 h-4 text-[#4338CA] dark:text-[#6366F1]" />
            {t('sections.routingStrategy')}
          </h4>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-semibold bg-card dark:bg-[#11131F] border border-border dark:border-white/[0.08] text-foreground px-3 py-1.5 rounded-lg">
              {routingStrategyLabels[providerConfig.ROUTING_STRATEGY]}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              ({providerConfig.ROUTING_STRATEGY})
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[#D97706]/10 dark:bg-[#F59E0B]/10 border border-[#D97706]/25 dark:border-[#F59E0B]/25 rounded-xl p-4 text-xs sm:text-sm text-[#D97706] dark:text-[#F59E0B] flex gap-3 items-start">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <p>{t('securityNote')}</p>
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-border dark:border-white/[0.08]">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground font-medium px-4 py-2 transition-colors text-sm"
        >
          {t('actions.back')}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading || !hasRequired}
          className={cn(
            "bg-[#4338CA] dark:bg-[#6366F1] hover:opacity-95 text-white px-7 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 shadow-xs",
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
