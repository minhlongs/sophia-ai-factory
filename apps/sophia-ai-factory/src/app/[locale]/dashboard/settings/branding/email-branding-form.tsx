'use client'

/**
 * Email branding form — save via /api/setup-wizard/save-credentials with email_branding payload.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/settings/branding/email-branding-form
 */

import { useState } from 'react'

interface Props { locale: string; userId: string }

export function EmailBrandingForm({ locale }: Props) {
  const isVi = locale.startsWith('vi')

  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [accentColor, setAccentColor] = useState('#10b981')
  const [supportEmail, setSupportEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const payload: Record<string, string> = {}
      if (senderName) payload.email_branding_sender_name = senderName
      if (senderEmail) payload.email_branding_sender_email = senderEmail
      if (logoUrl) payload.email_branding_logo_url = logoUrl
      if (accentColor) payload.email_branding_accent_color = accentColor
      if (supportEmail) payload.email_branding_support_email = supportEmail

      const res = await fetch('/api/setup-wizard/save-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setResult({
        ok: res.ok,
        message: res.ok
          ? (isVi ? 'Đã lưu thương hiệu email thành công!' : 'Email branding saved successfully!')
          : (isVi ? 'Có lỗi xảy ra khi lưu' : 'Failed to save'),
      })
    } catch {
      setResult({ ok: false, message: isVi ? 'Lỗi kết nối' : 'Connection error' })
    } finally {
      setLoading(false)
    }
  }

  function Field({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string
  }) {
    return (
      <div>
        <label className="block text-sm text-muted-foreground mb-1">{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Field
        label={isVi ? 'Tên người gửi' : 'Sender Name'}
        value={senderName}
        onChange={setSenderName}
        placeholder={isVi ? 'VD: Công ty ABC' : 'e.g. Acme Corp'}
      />
      <Field
        label={isVi ? 'Email người gửi' : 'Sender Email'}
        value={senderEmail}
        onChange={setSenderEmail}
        placeholder="noreply@yourcompany.com"
        type="email"
      />
      <Field
        label={isVi ? 'URL logo (https)' : 'Logo URL (https)'}
        value={logoUrl}
        onChange={setLogoUrl}
        placeholder="https://yourcompany.com/logo.png"
        type="url"
      />
      <Field
        label={isVi ? 'Email hỗ trợ' : 'Support Email'}
        value={supportEmail}
        onChange={setSupportEmail}
        placeholder="support@yourcompany.com"
        type="email"
      />
      <div>
        <label className="block text-sm text-muted-foreground mb-1">
          {isVi ? 'Màu chủ đạo (hex)' : 'Accent Color (hex)'}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border-0"
          />
          <input
            type="text"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            placeholder="#10b981"
            className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {result && (
        <p className={`text-sm ${result.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {result.message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-primary-700 hover:bg-primary-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        {loading ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Lưu thương hiệu' : 'Save Branding')}
      </button>
    </form>
  )
}
