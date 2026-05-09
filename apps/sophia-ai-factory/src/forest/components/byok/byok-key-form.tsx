'use client'

/**
 * BYOK Key Form — Phase 8C client component.
 *
 * Posts to /api/user/byok for set (POST) and clear (DELETE). Never fetches
 * plaintext keys — only the list of configured providers comes back from GET.
 * "Test Connection" button calls /api/user/byok/test to verify stored key.
 */

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { KeyRound, Trash2, Check, Wifi, WifiOff, Loader2 } from 'lucide-react'

export type UserSettableProvider = 'openrouter' | 'anthropic' | 'elevenlabs' | 'd-id' | 'muapi'
type Provider = UserSettableProvider

const PROVIDERS: { value: Provider; label: string; hint: string }[] = [
  { value: 'openrouter', label: 'OpenRouter',  hint: 'sk-or-v1-...'   },
  { value: 'anthropic',  label: 'Anthropic',   hint: 'sk-ant-...'      },
  { value: 'elevenlabs', label: 'ElevenLabs',  hint: '20+ char token'  },
  { value: 'd-id',       label: 'D-ID',        hint: 'Basic ...'       },
  { value: 'muapi',      label: 'MuAPI',       hint: '20+ char token'  },
]

interface ByokKeyFormProps {
  configured: Provider[]
}

interface TestResult {
  provider: Provider
  ok: boolean
  latencyMs?: number
  error?: string
}

export function ByokKeyForm({ configured: initialConfigured }: ByokKeyFormProps) {
  const t = useTranslations('byok')
  const [configured, setConfigured] = useState<Provider[]>(initialConfigured)
  const [provider,   setProvider]   = useState<Provider>('openrouter')
  const [keyValue,   setKeyValue]   = useState('')
  const [status,     setStatus]     = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()
  const [testResults, setTestResults] = useState<Record<Provider, TestResult | null>>({} as Record<Provider, TestResult | null>)
  const [testingProvider, setTestingProvider] = useState<Provider | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (keyValue.trim().length < 10) {
      setStatus(t('error_format'))
      return
    }

    startTransition(async () => {
      setStatus(null)
      try {
        const res = await fetch('/api/user/byok', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, key: keyValue.trim() }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
          setStatus(err.error ?? t('error_format'))
          return
        }
        setConfigured((prev) => (prev.includes(provider) ? prev : [...prev, provider]))
        setKeyValue('')
        setStatus(t('saved', { provider }))
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
        setStatus(t('cleared', { provider: p }))
      } catch {
        setStatus(t('network_error'))
      }
    })
  }

  const currentHint = PROVIDERS.find((p) => p.value === provider)?.hint ?? ''

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {status && (
        <div className="rounded-lg bg-muted px-4 py-2 text-sm text-foreground">
          {status}
        </div>
      )}

      {/* Configured list */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t('configured_providers', { count: configured.length })}
        </h2>
        {configured.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('no_keys')}
          </p>
        ) : (
          <ul className="space-y-2">
            {configured.map((p) => (
              <li
                key={p}
                className="flex items-center justify-between rounded-md bg-muted px-3 py-2"
              >
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                  {PROVIDERS.find((x) => x.value === p)?.label ?? p}
                  {testResults[p] && (
                    <span
                      className={`text-xs font-medium ${testResults[p]!.ok ? 'text-green-400' : 'text-red-400'}`}
                      title={testResults[p]!.error ?? `${testResults[p]!.latencyMs}ms`}
                    >
                      {testResults[p]!.ok
                        ? `✓ ${testResults[p]!.latencyMs}ms`
                        : `✗ ${testResults[p]!.error?.slice(0, 30) ?? 'failed'}`}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTest(p)}
                    disabled={isPending || testingProvider === p}
                    className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                    aria-label={`Test ${p} connection`}
                  >
                    {testingProvider === p ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : testResults[p]?.ok ? (
                      <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : testResults[p] && !testResults[p]!.ok ? (
                      <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {t('test_button')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClear(p)}
                    disabled={isPending}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Clear ${p} key`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('clear_button')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add / rotate form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          {t('add_or_rotate')}
        </h2>

        <div className="space-y-2">
          <label htmlFor="byok-provider" className="block text-xs font-medium text-muted-foreground">
            {t('provider_label')}
          </label>
          <select
            id="byok-provider"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Provider)}
            disabled={isPending}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}{configured.includes(p.value) ? ` (${t('rotate')})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="byok-key" className="block text-xs font-medium text-muted-foreground">
            {t('key_label')}
          </label>
          <input
            id="byok-key"
            type="password"
            autoComplete="off"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={currentHint}
            disabled={isPending}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-mono disabled:opacity-50"
            aria-describedby="byok-key-hint"
          />
          <p id="byok-key-hint" className="text-xs text-muted-foreground">
            {t('key_hint')}
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || keyValue.trim().length < 10}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? t('saving') : t('save_button')}
        </button>
      </form>
    </div>
  )
}
