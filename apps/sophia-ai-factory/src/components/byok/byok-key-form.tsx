'use client'

/**
 * BYOK Key Form — Phase 8C client component.
 *
 * Posts to /api/user/byok for set (POST) and clear (DELETE). Never fetches
 * plaintext keys — only the list of configured providers comes back from GET.
 */

import { useState, useTransition } from 'react'
import { KeyRound, Trash2, Check } from 'lucide-react'

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

export function ByokKeyForm({ configured: initialConfigured }: ByokKeyFormProps) {
  const [configured, setConfigured] = useState<Provider[]>(initialConfigured)
  const [provider,   setProvider]   = useState<Provider>('openrouter')
  const [keyValue,   setKeyValue]   = useState('')
  const [status,     setStatus]     = useState<string | null>(null)
  const [isPending,  startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (keyValue.trim().length < 10) {
      setStatus('Key too short — must be at least 10 characters.')
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
          setStatus(err.error ?? 'Failed to save key')
          return
        }
        setConfigured((prev) => (prev.includes(provider) ? prev : [...prev, provider]))
        setKeyValue('')
        setStatus(`Saved ${provider} key / Đã lưu`)
      } catch {
        setStatus('Network error — try again / Lỗi mạng, thử lại')
      }
    })
  }

  function handleClear(p: Provider) {
    const label = PROVIDERS.find((x) => x.value === p)?.label ?? p
    const confirmed = window.confirm(
      `Xóa key ${label}? Bạn sẽ mất quyền sử dụng feature này.\nDelete ${label} key? You'll lose access to this feature.`,
    )
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
          setStatus(err.error ?? 'Failed to clear key')
          return
        }
        setConfigured((prev) => prev.filter((x) => x !== p))
        setStatus(`Cleared ${p} key / Đã xóa`)
      } catch {
        setStatus('Network error — try again / Lỗi mạng, thử lại')
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
          Configured providers / Nhà cung cấp đã lưu ({configured.length})
        </h2>
        {configured.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No keys stored yet. Add one below. / Chưa có khóa. Thêm bên dưới.
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
                </span>
                <button
                  type="button"
                  onClick={() => handleClear(p)}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Clear ${p} key`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear / Xóa
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add / rotate form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          Add or rotate a key / Thêm hoặc xoay khóa
        </h2>

        <div className="space-y-2">
          <label htmlFor="byok-provider" className="block text-xs font-medium text-muted-foreground">
            Provider / Nhà cung cấp
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
                {p.label}{configured.includes(p.value) ? ' (rotate)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="byok-key" className="block text-xs font-medium text-muted-foreground">
            API Key / Khóa API
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
            Keys are encrypted at rest and never returned from the server. /
            Khóa được mã hóa, server không bao giờ trả lại.
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || keyValue.trim().length < 10}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving… / Đang lưu…' : 'Save key / Lưu khóa'}
        </button>
      </form>
    </div>
  )
}
