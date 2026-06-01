'use client'

/**
 * BYOK Key Form — Phase 8C client component.
 *
 * Posts to /api/user/byok for set (POST) and clear (DELETE). Never fetches
 * plaintext keys — only the list of configured providers comes back from GET.
 * "Test Connection" button calls /api/user/byok/test to verify stored key.
 */

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Globe,
  Bot,
  Volume2,
  Video,
  Layers,
  Search,
  Mail,
  KeyRound,
  Trash2,
  Check,
  Wifi,
  WifiOff,
  Loader2,
  Edit2
} from 'lucide-react'
import { ByokHelpTip } from '@/components/onboarding/byok-help-tip'
import { validateProviderKey } from '@/tree/byok/key-format-validators'

export type UserSettableProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'muapi' | 'apollo' | 'hunter'
type Provider = UserSettableProvider

const PROVIDERS: { value: Provider; label: string; hint: string }[] = [
  { value: 'openrouter', label: 'OpenRouter',  hint: 'sk-or-v1-...'   },
  { value: 'anthropic',  label: 'Anthropic',   hint: 'sk-ant-...'      },
  { value: 'elevenlabs', label: 'ElevenLabs',  hint: '20+ char token'  },
  { value: 'd-id',       label: 'D-ID',        hint: 'Basic ...'       },
  { value: 'muapi',      label: 'MuAPI',       hint: '20+ char token'  },
  { value: 'apollo',     label: 'Apollo.io',   hint: 'lead finder key' },
  { value: 'hunter',     label: 'Hunter.io',   hint: 'email finder key' },
]

const PROVIDER_ICONS: Record<Provider, React.ComponentType<{ className?: string }>> = {
  openrouter: Globe,
  anthropic: Bot,
  elevenlabs: Volume2,
  'd-id': Video,
  muapi: Layers,
  apollo: Search,
  hunter: Mail,
}

/**
 * Strip the `byok.` namespace prefix because `useTranslations('byok')` is
 * already scoped. Validator returns full path so it can be reused outside this
 * component too.
 */
function stripNamespace(fullKey: string): string {
  return fullKey.startsWith('byok.') ? fullKey.slice(5) : fullKey
}

interface ByokKeyFormProps {
  configured: Provider[]
}

interface TestResult {
  provider: Provider
  ok: boolean
  latencyMs?: number
  error?: string
}

function StatusBadge({ status }: { status: 'not_configured' | 'connected' | 'error' | 'testing' }) {
  if (status === 'testing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse">
        <span className="w-1 h-1 rounded-full bg-blue-400 animate-ping" />
        Testing
      </span>
    )
  }
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
        <Check className="h-3 w-3 text-emerald-400" />
        Active
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/20">
        <WifiOff className="h-3 w-3 text-rose-400" />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
      Inactive
    </span>
  )
}

export function ByokKeyForm({ configured: initialConfigured }: ByokKeyFormProps) {
  const t = useTranslations('byok')
  const [configured, setConfigured] = useState<Provider[]>(initialConfigured)
  const [status,     setStatus]     = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()
  const [testResults, setTestResults] = useState<Record<Provider, TestResult | null>>({} as Record<Provider, TestResult | null>)
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null)

  // Track inputs per provider card
  const [keyInputs, setKeyInputs] = useState<Record<Provider, string>>({} as Record<Provider, string>)
  // Track editing state per provider card
  const [editingProviders, setEditingProviders] = useState<Record<Provider, boolean>>({} as Record<Provider, boolean>)

  // Handle inputs and validations
  const handleInputChange = (p: Provider, value: string) => {
    setKeyInputs((prev) => ({ ...prev, [p]: value }))
  }

  const validations = useMemo(() => {
    const results = {} as Record<Provider, ReturnType<typeof validateProviderKey>>
    PROVIDERS.forEach(({ value: p }) => {
      results[p] = validateProviderKey(p, keyInputs[p] || '')
    });
    return results
  }, [keyInputs])

  const toggleEditing = (p: Provider, isEditing: boolean) => {
    setEditingProviders((prev) => ({ ...prev, [p]: isEditing }))
    if (!isEditing) {
      // Clear input on cancel
      setKeyInputs((prev) => ({ ...prev, [p]: '' }))
    }
  }

  function handleSingleSubmit(e: React.FormEvent, p: Provider) {
    e.preventDefault()
    const validation = validations[p]
    const keyValue = keyInputs[p] || ''

    if (!validation.ok) {
      setStatus(validation.errorKey ? t(stripNamespace(validation.errorKey)) : t('error_format'))
      return
    }

    // For D-ID, if we auto-encoded the user's raw paste, submit the encoded form.
    const submitKey = validation.autoEncoded ?? keyValue.trim()

    startTransition(async () => {
      setStatus(null)
      try {
        const res = await fetch('/api/user/byok', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: p, key: submitKey }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
          setStatus(err.error ?? t('error_format'))
          return
        }
        setConfigured((prev) => (prev.includes(p) ? prev : [...prev, p]))
        setKeyInputs((prev) => ({ ...prev, [p]: '' }))
        setEditingProviders((prev) => ({ ...prev, [p]: false }))
        setStatus(t('saved', { provider: p }))
        // Auto-run connection test
        handleTest(p)
      } catch {
        setStatus(t('network_error'))
      }
    })
  }

  async function handleTest(p: Provider) {
    setTestingProvider(p)
    try {
      const res = await fetch('/api/user/byok/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: p }),
      })
      const data = (await res.json().catch(() => ({ ok: false, error: 'Parse error' }))) as {
        ok: boolean
        latencyMs?: number
        status?: number
        error?: string
      }
      setTestResults((prev) => ({
        ...prev,
        [p]: { provider: p, ok: data.ok, latencyMs: data.latencyMs, error: data.error },
      }))
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [p]: { provider: p, ok: false, error: err instanceof Error ? err.message : t('network_error') },
      }))
    } finally {
      setTestingProvider(null)
    }
  }

  function handleClear(p: Provider) {
    const label = PROVIDERS.find((x) => x.value === p)?.label ?? p
    const confirmed = window.confirm(t('clear_confirm', { label }))
    if (!confirmed) return

    startTransition(async () => {
      setStatus(null)
      try {
        const res = await fetch('/api/user/byok', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: p }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
          setStatus(err.error ?? t('error_format'))
          return
        }
        setConfigured((prev) => prev.filter((x) => x !== p))
        // Clear test results too
        setTestResults((prev) => ({ ...prev, [p]: null }))
        setStatus(t('cleared', { provider: p }))
      } catch {
        setStatus(t('network_error'))
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status && (
        <div className="rounded-lg bg-white/[0.04] border border-white/10 px-4 py-2.5 text-sm text-foreground flex items-center justify-between">
          <span>{status}</span>
          <button onClick={() => setStatus(null)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}

      {/* Grid Cards of Providers */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((pInfo) => {
          const p = pInfo.value
          const Icon = PROVIDER_ICONS[p] || KeyRound
          const isConfigured = configured.includes(p)
          const isEditing = editingProviders[p] || !isConfigured

          let badgeStatus: 'not_configured' | 'connected' | 'error' | 'testing' = 'not_configured'
          if (testingProvider === p) {
            badgeStatus = 'testing'
          } else if (isConfigured) {
            if (testResults[p] && !testResults[p]!.ok) {
              badgeStatus = 'error'
            } else {
              badgeStatus = 'connected'
            }
          }

          return (
            <div
              key={p}
              className="bg-white/[0.02] border border-white/10 backdrop-blur-md rounded-xl p-5 flex flex-col justify-between gap-5 transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.02)] min-h-[230px]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="bg-white/[0.04] border border-white/5 p-2 rounded-lg text-violet-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{pInfo.label}</h3>
                    <p className="text-[11px] text-muted-foreground">API Connector</p>
                  </div>
                </div>
                <StatusBadge status={badgeStatus} />
              </div>

              {isEditing ? (
                <form onSubmit={(e) => handleSingleSubmit(e, p)} className="space-y-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      API Key
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={keyInputs[p] || ''}
                      onChange={(e) => handleInputChange(p, e.target.value)}
                      placeholder={pInfo.hint}
                      disabled={isPending}
                      className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-1.5 text-xs text-foreground font-mono placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50"
                    />
                    {keyInputs[p]?.trim() && !validations[p]?.ok && validations[p]?.errorKey && (
                      <p className="text-[10px] text-rose-400 mt-1" role="alert">
                        {t(stripNamespace(validations[p]!.errorKey!))}
                      </p>
                    )}
                    {validations[p]?.ok && validations[p]?.autoEncoded && (
                      <p className="text-[10px] text-amber-400 mt-1">
                        {t('validate.did.auto_encoded')}
                      </p>
                    )}
                    {(p === 'openrouter' || p === 'elevenlabs' || p === 'd-id') && (
                      <div className="pt-1">
                        <ByokHelpTip provider={p} />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isPending || !validations[p]?.ok}
                      className="flex-1 bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-foreground h-8 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isPending ? 'Saving...' : 'Save Key'}
                    </button>
                    {isConfigured && (
                      <button
                        type="button"
                        onClick={() => toggleEditing(p, false)}
                        className="border border-white/10 bg-white/[0.01] hover:bg-white/[0.05] text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-3 rounded-lg transition-all"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-zinc-950/40 border border-white/5 rounded-lg px-3 py-2">
                    <span className="text-sm font-mono text-zinc-500 select-none">••••••••••••</span>
                    {testResults[p] && (
                      <span
                        className={`text-xs font-semibold ${testResults[p]!.ok ? 'text-emerald-400' : 'text-rose-400'}`}
                        title={testResults[p]!.error}
                      >
                        {testResults[p]!.ok
                          ? `✓ ${testResults[p]!.latencyMs}ms`
                          : `✗ Error`}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleTest(p)}
                      disabled={isPending || testingProvider === p}
                      className="flex-1 border border-white/10 bg-white/[0.01] hover:bg-white/[0.05] text-xs font-semibold text-blue-400 hover:text-blue-300 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      {testingProvider === p ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5" />
                      )}
                      {t('test_button')}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleEditing(p, true)}
                      disabled={isPending}
                      className="flex-1 border border-white/10 bg-white/[0.01] hover:bg-white/[0.05] text-xs font-semibold text-amber-400 hover:text-amber-300 h-8 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClear(p)}
                      disabled={isPending}
                      className="border border-white/10 bg-white/[0.01] hover:bg-rose-500/5 text-xs font-semibold text-rose-500 hover:text-rose-400 h-8 px-2.5 rounded-lg flex items-center justify-center transition-all"
                      aria-label="Delete key"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
