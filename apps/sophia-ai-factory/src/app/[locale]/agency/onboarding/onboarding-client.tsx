'use client'
import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { AGENCY_TIERS } from '@/seed/config/tiers/tier-configs'

type AgencyTier = 'starter' | 'growth' | 'enterprise'
const tierKeys: AgencyTier[] = ['starter', 'growth', 'enterprise']

export function OnboardingClient() {
  const t = useTranslations('agencyOnboarding')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [tier, setTier] = useState<AgencyTier>('starter')

  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 50
  const canSubmit = name.trim().length > 0 && slugValid && slugAvailable === true

  const checkSlug = useCallback(async (s: string) => {
    if (!s || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) || s.length < 3 || s.length > 50) {
      setSlugAvailable(null)
      return
    }
    try {
      const res = await fetch(`/api/agency/slug-check?slug=${encodeURIComponent(s)}`)
      const data = (await res.json()) as { available: boolean }
      setSlugAvailable(data.available)
    } catch {
      setSlugAvailable(null)
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/agency/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), tier }),
      })
      const data = (await res.json()) as { apiKey?: string; error?: { message?: string }; message?: string }
      if (!res.ok) {
        setError(data.error?.message || data.message || 'Registration failed')
        return
      }
      if (data.apiKey) {
        router.push(`/agency/onboarding/api-key?key=${encodeURIComponent(data.apiKey)}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">{t('nameLabel')}</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border px-3 py-2 text-sm" />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium mb-1">{t('slugLabel')}</label>
        <input id="slug" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugTouched(true); checkSlug(e.target.value) }} required className={`w-full rounded-md border px-3 py-2 text-sm ${slugTouched ? (slugAvailable === true ? 'border-emerald-300' : slugAvailable === false ? 'border-red-300' : 'border-amber-300') : ''}`} />
        {slugTouched && slugAvailable === true && <p className="text-xs text-emerald-600 mt-1">Available</p>}
        {slugTouched && slugAvailable === false && <p className="text-xs text-red-600 mt-1">Taken</p>}
      </div>

      <div>
        <label htmlFor="tier" className="block text-sm font-medium mb-1">{t('tierLabel')}</label>
        <select id="tier" value={tier} onChange={(e) => setTier(e.target.value as AgencyTier)} className="w-full rounded-md border px-3 py-2 text-sm">
          {tierKeys.map((k) => (
            <option key={k} value={k}>{k.toUpperCase()} — ${AGENCY_TIERS[k].monthlyPrice}/mo</option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={!canSubmit || submitting} className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
        {submitting && <Loader2 className="inline h-4 w-4 animate-spin mr-2" />}
        {t('submit')}
      </button>
    </form>
  )
}
