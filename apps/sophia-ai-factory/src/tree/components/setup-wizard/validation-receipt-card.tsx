"use client";

/**
 * Zero-execution BYOK ValidationReceipt card for Setup Wizard onboarding.
 *
 * Displays verified key capabilities, probe latency, current month spend, and
 * budget verdict using semantic Zen Design OS tokens without hardcoded colors.
 *
 * @module tree/components/setup-wizard/validation-receipt-card
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  BudgetVerdict,
  KeyCapability,
  ValidationReceipt,
} from '@/tree/byok/validation-receipt-types';

export interface ValidationReceiptCardProps {
  receipt?: ValidationReceipt | null;
  latencyMs?: number;
}

const CAPABILITY_LABEL_KEYS: Readonly<Record<KeyCapability, 'capJsonSchema' | 'capToolCall' | 'capVision'>> = {
  json_schema: 'capJsonSchema',
  tool_call: 'capToolCall',
  vision: 'capVision',
};

function formatVerdictText(
  verdict: BudgetVerdict,
  t: ReturnType<typeof useTranslations>,
): { text: string; isRefusal: boolean } {
  switch (verdict.outcome) {
    case 'within_budget': {
      const suffix = verdict.remainingUsd !== null ? `: $${verdict.remainingUsd.toFixed(2)}` : '';
      return { text: `${t('budgetWithin')}${suffix}`, isRefusal: false };
    }
    case 'no_cap_set':
      return { text: t('budgetNoCap'), isRefusal: false };
    case 'budget_exhausted':
      return { text: t('budgetExhausted'), isRefusal: true };
    case 'cooldown_active':
      return { text: t('budgetCooldown'), isRefusal: true };
  }
}

export function ValidationReceiptCard({ receipt, latencyMs }: ValidationReceiptCardProps) {
  const t = useTranslations('setupWizard.apiKeys.receipt');

  if (!receipt) {
    return null;
  }

  const effectiveVerdict: BudgetVerdict =
    receipt.verdict ?? { outcome: 'no_cap_set' };
  const { text: verdictText, isRefusal } = formatVerdictText(effectiveVerdict, t);
  const spentDisplay =
    receipt.budget.monthlyBudgetUsd !== null
      ? `$${receipt.budget.monthSpentUsd.toFixed(2)} / $${receipt.budget.monthlyBudgetUsd.toFixed(2)}`
      : `$${receipt.budget.monthSpentUsd.toFixed(2)}`;

  return (
    <div
      data-testid={`validation-receipt-${receipt.provider}`}
      className="rounded-xl border border-border bg-card p-3.5 space-y-2.5 text-left transition-colors"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <ShieldCheck className="w-4 h-4 text-primary-text shrink-0" aria-hidden="true" />
          <span>{t('title')}</span>
        </div>
        {receipt.maskedKey && (
          <span className="font-mono text-xs text-muted-foreground">{receipt.maskedKey}</span>
        )}
      </div>

      {receipt.capabilities.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="list">
          {receipt.capabilities.map((cap) => {
            const labelKey = CAPABILITY_LABEL_KEYS[cap];
            if (!labelKey) return null;
            return (
              <span
                key={cap}
                role="listitem"
                data-capability={cap}
                className="inline-flex items-center rounded-md border border-border bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-text"
              >
                {t(labelKey)}
              </span>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border text-xs">
        <div className="flex items-center justify-between sm:block">
          <span className="text-muted-foreground">{t('latencyLabel')}: </span>
          <span className="font-mono font-medium text-foreground">
            {typeof latencyMs === 'number' ? `${latencyMs}ms` : '—'}
          </span>
        </div>

        <div className="flex items-center justify-between sm:block">
          <span className="text-muted-foreground">{t('spentThisMonth')}: </span>
          <span className="font-mono font-medium text-foreground">{spentDisplay}</span>
        </div>

        <div className="flex items-center justify-between sm:block">
          <span
            className={
              isRefusal
                ? 'font-medium text-destructive'
                : 'font-medium text-foreground'
            }
          >
            {verdictText}
          </span>
        </div>
      </div>
    </div>
  );
}
