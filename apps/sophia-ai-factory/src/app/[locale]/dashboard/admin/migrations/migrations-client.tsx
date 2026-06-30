'use client'

/**
 * Supabase Migration Console — Hook B.
 * Lists pending Supabase migrations with Copy SQL + Open Supabase Editor + Mark Applied.
 * Semi-automated: admin runs SQL in Supabase dashboard, then marks applied here.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/migrations/migrations-client
 */

import { useState, useEffect, useCallback } from 'react'

interface Props { locale: string }

interface Migration {
  filename: string
  sha256: string
  content_b64: string
  applied: boolean
  applied_at: number | null
  applied_by: string | null
  notes: string | null
}

interface MigrationsData {
  migrations?: Migration[]
  supabase_editor_url?: string | null
  total?: number
  pending?: number
  error?: string
}

interface MarkResult {
  success: boolean
  error?: string
}

export function MigrationsClient({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const [data, setData] = useState<MigrationsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [markingFile, setMarkingFile] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/migrations')
      setData(await res.json() as MigrationsData)
    } catch {
      setData({ error: isVi ? 'Lỗi kết nối' : 'Connection error' })
    } finally {
      setLoading(false)
    }
  }, [isVi])

  useEffect(() => { void load() }, [load])

  function decodeContent(b64: string): string {
    try {
      return atob(b64)
    } catch {
      return ''
    }
  }

  async function copySQL(migration: Migration) {
    const sql = decodeContent(migration.content_b64)
    try {
      await navigator.clipboard.writeText(sql)
      setCopyFeedback(migration.filename)
      setTimeout(() => setCopyFeedback(null), 2000)
    } catch {
      // fallback: select text from hidden textarea
      const ta = document.createElement('textarea')
      ta.value = sql
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopyFeedback(migration.filename)
      setTimeout(() => setCopyFeedback(null), 2000)
    }
  }

  async function markApplied(filename: string) {
    setMarkingFile(filename)
    try {
      const res = await fetch(`/api/admin/migrations/${encodeURIComponent(filename)}/mark-applied`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes[filename] ?? '' }),
      })
      const result = await res.json() as MarkResult
      if (result.success) await load()
    } catch {
      // no-op
    } finally {
      setMarkingFile(null)
    }
  }

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground-500">{isVi ? 'Đang tải...' : 'Loading...'}</p>
  }

  if (data?.error) {
    return <p className="text-sm text-red-400">{data.error}</p>
  }

  const migrations = data?.migrations ?? []
  const pending = migrations.filter((m) => !m.applied)
  const applied = migrations.filter((m) => m.applied)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground-400">
          {isVi ? 'Tổng cộng:' : 'Total:'} <strong className="text-muted-foreground-100">{data?.total ?? 0}</strong>
        </span>
        <span className="text-muted-foreground-400">
          {isVi ? 'Chờ áp dụng:' : 'Pending:'} <strong className="text-yellow-400">{data?.pending ?? 0}</strong>
        </span>
        <button
          onClick={load}
          className="ml-auto text-xs text-muted-foreground-500 hover:text-muted-foreground-300 transition-colors"
        >
          {isVi ? 'Tải lại' : 'Refresh'}
        </button>
      </div>

      {/* Pending migrations */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-yellow-400">
            {isVi ? 'Chưa áp dụng' : 'Pending'}
          </h2>
          {pending.map((m) => (
            <div key={m.filename} className="rounded-xl border border-yellow-900/50 bg-muted-900/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-mono text-muted-foreground-200 break-all">{m.filename}</span>
                <span className="text-xs text-muted-foreground-600 font-mono shrink-0">{m.sha256.slice(0, 8)}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => copySQL(m)}
                  className="px-3 py-1.5 bg-muted-700 hover:bg-muted-600 text-white text-xs rounded-lg font-medium transition-colors"
                >
                  {copyFeedback === m.filename
                    ? (isVi ? 'Đã sao chép!' : 'Copied!')
                    : (isVi ? 'Sao chép SQL' : 'Copy SQL')}
                </button>
                {data?.supabase_editor_url && (
                  <a
                    href={data.supabase_editor_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    {isVi ? 'Mở Supabase Editor' : 'Open Supabase Editor'}
                  </a>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={notes[m.filename] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [m.filename]: e.target.value }))}
                  placeholder={isVi ? 'Ghi chú (tùy chọn)' : 'Notes (optional)'}
                  className="flex-1 bg-muted-800 border border-border-700 rounded-lg px-3 py-1.5 text-xs text-muted-foreground-100 placeholder:text-muted-foreground-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={() => {
                    const msg = isVi
                      ? `Đánh dấu migration "${m.filename}" đã áp dụng? Hành động này sẽ thay đổi trạng thái schema.`
                      : `Mark migration "${m.filename}" as applied? This changes schema state and cannot be easily undone.`;
                    if (window.confirm(msg)) markApplied(m.filename);
                  }}
                  disabled={markingFile === m.filename}
                  aria-label={isVi ? `Đánh dấu migration ${m.filename} đã áp dụng` : `Mark migration ${m.filename} as applied`}
                  className="px-3 py-1.5 bg-primary-700 hover:bg-primary-600 disabled:opacity-50 text-white text-xs rounded-lg font-medium transition-colors shrink-0"
                >
                  {markingFile === m.filename ? (isVi ? 'Đang xử lý…' : 'Applying…') : (isVi ? 'Đánh dấu đã áp dụng' : 'Mark Applied')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Applied migrations */}
      {applied.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground-500">
            {isVi ? 'Đã áp dụng' : 'Applied'}
          </h2>
          {applied.map((m) => (
            <div key={m.filename} className="rounded-lg border border-border-800 bg-muted-900/30 p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-muted-foreground-400 break-all">{m.filename}</span>
              <span className="text-xs text-emerald-500 shrink-0">
                {isVi ? 'Đã áp dụng' : 'Applied'}
                {m.applied_at ? ` — ${new Date(m.applied_at * 1000).toLocaleDateString()}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {pending.length === 0 && (
        <p className="text-sm text-emerald-400">
          {isVi ? 'Tất cả migrations đã được áp dụng.' : 'All migrations applied.'}
        </p>
      )}
    </div>
  )
}
