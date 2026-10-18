'use client';

/**
 * WhatsApp Credentials Step — setup wizard step for WhatsApp Business Cloud API.
 *
 * Collects Phone Number ID + WA Token (BYOK). WABA ID and Business ID are optional.
 *
 * Bilingual: Vietnamese + English labels/help text.
 */

import React from 'react';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { useTranslations } from 'next-intl';
import { SavedHint, WhatsAppOptionalFields } from './whatsapp-optional-fields';

export interface WhatsAppStepConfig {
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_WA_TOKEN: string;
  WHATSAPP_WABA_ID: string;
  WHATSAPP_BUSINESS_ID: string;
}

interface WhatsAppCredentialsStepProps {
  config: WhatsAppStepConfig;
  updateConfig: (key: keyof WhatsAppStepConfig, value: string) => void;
  savedCredentials: { phoneNumberId: string; wabaId?: string; businessId?: string } | null;
}

export function WhatsAppCredentialsStep({
  config,
  updateConfig,
  savedCredentials,
}: WhatsAppCredentialsStepProps) {
  const t = useTranslations('setupWizard.whatsapp');

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-xl font-bold text-foreground tracking-tight">
          {t('title') || 'WhatsApp Business Setup'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('subtitle') ||
            'Enter your WhatsApp Business Account credentials from Meta Business Suite. / Nhập thông tin tài khoản WhatsApp Business từ Meta Business Suite.'}
        </p>
      </div>

      {/* Phone Number ID — required */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded">
            Required / Bắt buộc
          </span>
        </div>
        <ApiKeyInput
          id="phone_number_id"
          label={t('phoneNumberIdLabel') || 'Phone Number ID'}
          value={config.WHATSAPP_PHONE_NUMBER_ID}
          onChange={(v) => updateConfig('WHATSAPP_PHONE_NUMBER_ID', v)}
          onVerify={async () => true}
          status="idle"
          errorMessage={''}
          placeholder={t('phoneNumberIdPlaceholder') || 'e.g. 1234567890123456'}
          required
          helpText={
            (t('phoneNumberIdHelp') ||
              'Find this in Meta Business Suite → WhatsApp → Settings → Phone Numbers / Tìm trong Meta Business Suite → WhatsApp → Cài đặt → Số điện thoại') +
            (savedCredentials?.phoneNumberId
              ? ` · Previous: ${savedCredentials.phoneNumberId}`
              : '')
          }
        />
        <SavedHint hint={null} />
      </div>

      {/* WA Token — required */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded">
            Required / Bắt buộc
          </span>
        </div>
        <ApiKeyInput
          id="wa_token"
          label={t('tokenLabel') || 'WhatsApp Access Token'}
          value={config.WHATSAPP_WA_TOKEN}
          onChange={(v) => updateConfig('WHATSAPP_WA_TOKEN', v)}
          onVerify={async () => true}
          status="idle"
          errorMessage={''}
          placeholder={t('tokenPlaceholder') || 'EAA...'}
          required
          helpText={
            t('tokenHelp') ||
            'Permanent access token from Meta App → Settings → Basic → Access Token / Token truy cập vĩnh viễn từ Meta App → Cài đặt → Cơ bản → Access Token'
          }
        />
        <SavedHint hint={null} />
      </div>

      <WhatsAppOptionalFields config={config} updateConfig={updateConfig} />
    </div>
  );
}
