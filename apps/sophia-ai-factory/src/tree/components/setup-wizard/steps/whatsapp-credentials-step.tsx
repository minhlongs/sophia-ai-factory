'use client';

/**
 * WhatsApp Credentials Step — setup wizard step for WhatsApp Business Cloud API.
 *
 * Collects Phone Number ID + WA Token (BYOK). WABA ID and Business ID are optional.
 *
 * Bilingual: Vietnamese + English labels/help text.
 */

import React, { useState } from 'react';
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input';
import { useTranslations } from 'next-intl';

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

function SavedHint({ hint }: { hint: string | null }) {
  if (!hint) return null;
  return (
    <p className="text-xs text-green-600 mt-1">
      Saved / Đã lưu: {hint} &nbsp;·&nbsp; Enter new value to replace / Nhập giá trị mới để thay thế
    </p>
  );
}

export function WhatsAppCredentialsStep({
  config,
  updateConfig,
  savedCredentials,
}: WhatsAppCredentialsStepProps) {
  const t = useTranslations('setupWizard.whatsapp');

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
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
          <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
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
          <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
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

      {/* WABA ID — optional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-muted-100 text-foreground px-2 py-0.5 rounded">
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
          <span className="text-xs font-bold uppercase tracking-wider bg-muted-100 text-foreground px-2 py-0.5 rounded">
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
    </div>
  );
}