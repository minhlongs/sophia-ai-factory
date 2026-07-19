'use client'
import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import type { AgencyBranding } from '@/seed/config/agency-branding'

export function BrandingClient({ agencyId, initial }: { agencyId: number; initial: AgencyBranding }) {
  const [form, setForm] = useState<AgencyBranding>(initial)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof AgencyBranding>(key: K, val: AgencyBranding[K]) {
    setForm((f) => ({ ...f, [key]: val }))
    setMessage(null)
    setError(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/agency/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId, ...form }),
      })
      const data = (await res.json()) as { error?: { message?: string }; message?: string }
      if (!res.ok) setError(data.error?.message || data.message || 'Save failed')
      else { setMessage('Saved'); setTimeout(() => setMessage(null), 3000) }
    } catch { setError('Network error') } finally { setSaving(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="rounded-lg border p-6" style={{ '--agency-primary': form.primaryColor, '--agency-secondary': form.secondaryColor } as React.CSSProperties}>
        <div className="flex items-center gap-3 mb-3">
          {form.logoUrl ? <img src={form.logoUrl} alt="" className="h-8" /> : (
            <div className="h-8 w-8 rounded-md flex items-center justify-center text-white text-sm font-bold" style={{ background: form.primaryColor }}>{form.displayName.charAt(0)}</div>
          )}
          <span className="font-semibold text-lg">{form.displayName}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{form.taglineVi} / {form.taglineEn}</p>
        <div className="flex gap-2">
          <button type="button" className="px-4 py-2 rounded-md text-white text-sm" style={{ background: form.primaryColor }}>Primary</button>
          <button type="button" className="px-4 py-2 rounded-md text-white text-sm" style={{ background: form.secondaryColor }}>Secondary</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input value={form.displayName} onChange={(e) => update('displayName', e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Logo URL</label>
          <input value={form.logoUrl ?? ''} onChange={(e) => update('logoUrl', e.target.value || null)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="https://..." />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Primary Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
            <input value={form.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} className="flex-1 rounded-md border px-3 py-2 text-sm font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Secondary Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.secondaryColor} onChange={(e) => update('secondaryColor', e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
            <input value={form.secondaryColor} onChange={(e) => update('secondaryColor', e.target.value)} className="flex-1 rounded-md border px-3 py-2 text-sm font-mono" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tagline (VI)</label>
          <input value={form.taglineVi} onChange={(e) => update('taglineVi', e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tagline (EN)</label>
          <input value={form.taglineEn} onChange={(e) => update('taglineEn', e.target.value)} className="w-full rounded-md border px-3 py-2 text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Custom Domain</label>
          <input value={form.customDomain ?? ''} onChange={(e) => update('customDomain', e.target.value || null)} className="w-full rounded-md border px-3 py-2 text-sm" placeholder="agency.example.com" />
        </div>
      </div>

      <button type="submit" disabled={saving} className="rounded-md bg-primary py-2.5 px-6 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {saving && <Loader2 className="inline h-4 w-4 animate-spin mr-2" />}
        Save
      </button>
      {message && <span className="inline-flex items-center gap-1 text-sm text-emerald-600 ml-3"><Check className="h-4 w-4" />{message}</span>}
    </form>
  )
}
