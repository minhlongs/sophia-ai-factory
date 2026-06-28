'use client'

/**
 * HeyGen Webhooks admin UI — Hook F.
 * Lists registered endpoints. Allows manual re-register.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/heygen-webhooks/heygen-webhooks-client
 */

import { useState, useEffect } from 'react'

interface Props { locale: string }

interface Endpoint {
  endpointId: string
  url: string
  events: string[]
}

interface ListData {
  success: boolean
  endpoints?: Endpoint[]
  error?: string
  user?: { id: string; email: string }
}

interface RegisterResult {
  success: boolean
  endpointId?: string
  webhookUrl?: string
  secretStored?: boolean
  error?: string
}

export function HeyGenWebhooksClient({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const [userId, setUserId] = useState('')
  const [listData, setListData] = useState<ListData | null>(null)
  const [loading, setLoading] = useState(false)
  const [regResult, setRegResult] = useState<RegisterResult | null>(null)

  async function fetchWebhooks() {
    if (!userId.trim()) return
    setLoading(true)
    setListData(null)
    try {
      const res = await fetch(`/api/admin/heygen/list-webhooks?userId=${encodeURIComponent(userId.trim())}`)
      setListData(await res.json() as ListData)
    } catch {
      setListData({ success: false, error: isVi ? 'Lỗi kết nối' : 'Connection error' })
    } finally {
      setLoading(false)
    }
  }

  async function reRegister() {
    setLoading(true)
    setRegResult(null)
    try {
      const res = await fetch('/api/setup-wizard/heygen/auto-register', { method: 'POST' })
      setRegResult(await res.json() as RegisterResult)
    } catch {
      setRegResult({ success: false, error: isVi ? 'Lỗi kết nối' : 'Connection error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Re-register section */}
      <div className="rounded-xl border border-border-800 bg-muted-900/50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground-200">
          {isVi ? 'Đăng ký lại webhook HeyGen (tài khoản của bạn)' : 'Re-register HeyGen Webhook (your account)'}
        </h2>
        <p className="text-xs text-muted-foreground-500">
          {isVi
            ? 'Chạy lại đăng ký webhook với khóa API HeyGen đã lưu của bạn. Tự động lưu signing secret.'
            : 'Re-runs webhook registration using your stored HeyGen API key. Auto-stores the signing secret.'}
        </p>
        <button
          onClick={reRegister}
          disabled={loading}
          className="px-4 py-2 bg-primary-700 hover:bg-primary-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {loading ? '…' : isVi ? 'Đăng ký lại webhook' : 'Re-register Webhook'}
        </button>
        {regResult && (
          <div className={`rounded-lg border p-3 text-xs ${regResult.success ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-red-800 bg-red-950/30 text-red-300'}`}>
            {regResult.success
              ? `OK — endpointId: ${regResult.endpointId ?? 'N/A'} | secret stored: ${String(regResult.secretStored)}`
              : `Error: ${regResult.error}`}
          </div>
        )}
      </div>

      {/* Debug listing — admin looks up any user's webhooks */}
      <div className="rounded-xl border border-border-800 bg-muted-900/50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground-200">
          {isVi ? 'Xem danh sách webhook của người dùng' : 'Debug: List user webhooks'}
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder={isVi ? 'User ID' : 'User ID'}
            className="flex-1 bg-muted-800 border border-border-700 rounded-lg px-3 py-2 text-sm text-muted-foreground-100 placeholder:text-muted-foreground-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            onClick={fetchWebhooks}
            disabled={loading || !userId.trim()}
            className="px-4 py-2 bg-muted-700 hover:bg-muted-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {loading ? '…' : isVi ? 'Tải' : 'Load'}
          </button>
        </div>

        {listData && (
          <div>
            {listData.success && listData.endpoints ? (
              <div className="space-y-2">
                {listData.endpoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground-500">{isVi ? 'Không có webhook nào.' : 'No webhooks registered.'}</p>
                ) : (
                  listData.endpoints.map((ep) => (
                    <div key={ep.endpointId} className="rounded-lg bg-muted-800 p-3 text-xs text-muted-foreground-300 space-y-1">
                      <div><span className="text-muted-foreground-500">ID:</span> {ep.endpointId}</div>
                      <div><span className="text-muted-foreground-500">URL:</span> {ep.url}</div>
                      <div><span className="text-muted-foreground-500">Events:</span> {ep.events.join(', ')}</div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-red-400">{listData.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
