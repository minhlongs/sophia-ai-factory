'use client';

/**
 * Optional fields and hint helper for WhatsApp Credentials Step.
 *
 * Bilingual: Vietnamese + English labels/help text.
 */

import React from 'react';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { useTranslations } from 'next-intl';
import type { WhatsAppStepConfig } from './whatsapp-credentials-step';

export function SavedHint({ hint }: { hint: string | null }) {
  if (!hint) return null;
  return (
    <p className="font-mono text-xs text-emerald-700 dark:text-emerald-400 mt-1">
      Saved / Đã lưu: {hint} &nbsp;·&nbsp; Enter new value to replace / Nhập giá trị mới để thay thế
    </p>
  );
}

interface WhatsAppOptionalFieldsProps {
  config: WhatsAppStepConfig;
  updateConfig: (key: keyof WhatsAppStepConfig, value: string) => void;
}

export function WhatsAppOptionalFields({
  config,
  updateConfig,
}: WhatsAppOptionalFieldsProps) {
  const t = useTranslations('setupWizard.whatsapp');

  return (
    <>
      {/* WABA ID — optional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-muted border border-border dark:border-white/[0.08] text-muted-foreground px-2 py-0.5 rounded">
            Optional / Tùy chọn
          </span>
        </div>
        <ApiKeyInput
          id="waba_id"
          label={t('wabaIdLabel') || 'WhatsApp Business Account ID (WABA)'}
          value={config.WHATSAPP_WABA_ID}
          onChange={(v) => updateConfig('WHATSAPP_WABA_ID', v)}
          onVerify={async () => true}
          status="idle"
          errorMessage={''}
          placeholder={t('wabaIdPlaceholder') || 'e.g. 9876543210'}
          helpText={
            t('wabaIdHelp') ||
            'Optional. Your WABA ID from Meta Business Suite → WhatsApp → Account Details / Tùy chọn. WABA ID từ Meta Business Suite → WhatsApp → Chi tiết tài khoản.'
          }
        />
      </div>

      {/* Business ID — optional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-muted border border-border dark:border-white/[0.08] text-muted-foreground px-2 py-0.5 rounded">
            Optional / Tùy chọn
          </span>
        </div>
        <ApiKeyInput
          id="business_id"
          label={t('businessIdLabel') || 'Meta Business ID'}
          value={config.WHATSAPP_BUSINESS_ID}
          onChange={(v) => updateConfig('WHATSAPP_BUSINESS_ID', v)}
          onVerify={async () => true}
          status="idle"
          errorMessage={''}
          placeholder={t('businessIdPlaceholder') || 'e.g. 1122334455'}
          helpText={
            t('businessIdHelp') ||
            'Optional. Meta Business Manager ID from business.facebook.com / Tùy chọn. ID Business Manager từ business.facebook.com'
          }
        />
      </div>
    </>
  );
}
