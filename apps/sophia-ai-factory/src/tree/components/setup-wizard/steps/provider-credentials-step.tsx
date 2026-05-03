"use client";

/**
 * Provider Credentials Step — setup wizard step for HeyGen, Resend, NOWPayments keys.
 *
 * HeyGen: required for video generation (customer must supply own key)
 * Resend: optional (falls back to platform's key for transactional emails)
 * NOWPayments: optional for now (platform shared provider for MVP)
 *
 * Bilingual: Vietnamese + English labels/help text.
 *
 * @module app/setup-wizard/components/steps/provider-credentials-step
 */

import React from 'react'
import { ApiKeyInput } from '@/tree/components/setup-wizard/api-key-input'
import type { CredentialSummary } from '@/tree/credentials/user-credentials-repo'

export interface ProviderConfig {
  HEYGEN_API_KEY: string
  RESEND_API_KEY: string
  NOWPAYMENTS_API_KEY: string
  HEYGEN_WEBHOOK_SECRET: string
}

interface ProviderCredentialsStepProps {
  config: ProviderConfig
  updateConfig: (key: keyof ProviderConfig, value: string) => void
  status: Record<string, 'idle' | 'validating' | 'valid' | 'invalid'>
  errors: Record<string, string>
  onTestKey: (provider: string, fieldKey: keyof ProviderConfig, value: string) => Promise<boolean>
  savedCredentials: CredentialSummary[]
}

function SavedHint({ hint }: { hint: string | null }) {
  if (!hint) return null
  return (
    <p className="text-xs text-green-600 mt-1">
      Key saved: {hint} &nbsp;·&nbsp; Enter new value to replace /
      Khóa đã lưu — nhập giá trị mới để thay thế
    </p>
  )
}

export function ProviderCredentialsStep({
  config,
  updateConfig,
  status,
  errors,
  onTestKey,
  savedCredentials,
}: ProviderCredentialsStepProps) {
  const getSaved = (provider: string) =>
    savedCredentials.find((c) => c.provider === provider) ?? null

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-xl font-semibold text-foreground">
          Provider Keys / Khóa nhà cung cấp
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your own API keys so videos and emails run under your account.
          <br />
          Cấu hình khóa API để video và email chạy dưới tài khoản của bạn.
        </p>
      </div>

      {/* HeyGen — required */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded">
            Required / Bắt buộc
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
          required
          helpText="Your HeyGen API key for video generation. Get it from app.heygen.com → Account → API. / Khóa HeyGen để tạo video."
        />
        <SavedHint hint={getSaved('heygen')?.display_hint ?? null} />

        {/* HeyGen Webhook callout */}
        <div className="mt-3 rounded-lg border border-sky-900/50 bg-sky-950/30 p-4 space-y-3">
          <p className="text-sm font-semibold text-sky-300">
            🔗 Connect HeyGen Webhook (Optional but Recommended) / Kết nối HeyGen Webhook (Khuyến nghị)
          </p>
          <ol className="text-xs text-zinc-400 space-y-1.5 list-none">
            <li>1. Open HeyGen → <span className="text-zinc-300">app.heygen.com</span> → Account → API → Webhooks</li>
            <li>2. Add this URL / Thêm URL này:</li>
            <li>
              <span className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-900 text-emerald-400 rounded px-2 py-1 text-xs font-mono select-all">
                  https://sophia.agencyos.network/api/webhooks/heygen
                </code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText('https://sophia.agencyos.network/api/webhooks/heygen')}
                  className="shrink-0 text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
                >
                  Copy
                </button>
              </span>
            </li>
            <li>3. Copy the signing secret HeyGen shows you / Sao chép secret mà HeyGen hiển thị</li>
            <li>4. Paste below / Dán vào bên dưới</li>
          </ol>
          <ApiKeyInput
            id="heygen_webhook_secret"
            label="HeyGen Webhook Secret (Optional)"
            value={config.HEYGEN_WEBHOOK_SECRET ?? ''}
            onChange={(v) => updateConfig('HEYGEN_WEBHOOK_SECRET', v)}
            onVerify={async () => true}
            status="idle"
            errorMessage=""
            placeholder="HeyGen webhook signing secret..."
            helpText="Paste the signing secret from HeyGen webhook settings. / Dán secret từ cài đặt webhook HeyGen."
          />
        </div>
      </div>

      {/* Resend — optional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
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
          helpText="Your Resend key for transactional emails. Falls back to platform key if not set. / Khóa Resend cho email. Nếu không nhập, hệ thống sẽ dùng khóa của nền tảng."
        />
        <SavedHint hint={getSaved('resend')?.display_hint ?? null} />
      </div>

      {/* NOWPayments — optional */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            Advanced / Nâng cao
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
          helpText="Optional. Platform's payment provider is shared. Only set if running your own NOWPayments account. / Tùy chọn. Nền tảng dùng chung tài khoản thanh toán. Chỉ cần nếu bạn chạy tài khoản NOWPayments riêng."
        />
        <SavedHint hint={getSaved('nowpayments')?.display_hint ?? null} />
      </div>
    </div>
  )
}
