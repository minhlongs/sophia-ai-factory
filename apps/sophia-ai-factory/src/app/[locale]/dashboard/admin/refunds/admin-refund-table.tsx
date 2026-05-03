'use client'

/**
 * Admin refund table — SWR-polled list with approve/reject/mark-refunded actions.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/refunds/admin-refund-table
 */

import { useState } from 'react'
import useSWR from 'swr'
import type { RefundRequest } from '@/land/refunds/refund-repo'

interface RefundsResponse { refunds: RefundRequest[] }

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<RefundsResponse>)

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300',
  approved: 'bg-blue-900/50 text-blue-300',
  rejected: 'bg-red-900/50 text-red-300',
  refunded: 'bg-emerald-900/50 text-emerald-300',
}

interface Props { locale: string }

export function AdminRefundTable({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const { data, mutate } = useSWR<RefundsResponse>('/api/admin/refunds', fetcher, { refreshInterval: 30000 })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [txHashInputs, setTxHashInputs] = useState<Record<string, string>>({})
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({})

  async function doAction(id: string, action: string, body: Record<string, unknown>) {
    setActionLoading(`${id}-${action}`)
    try {
      const url = action === 'mark-refunded'
        ? `/api/admin/refunds/${id}/mark-refunded`
        : `/api/admin/refunds/${id}`
      const method = action === 'mark-refunded' ? 'POST' : 'PATCH'
      const payload = action === 'mark-refunded' ? body : { action, ...body }
      await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      await mutate()
    } finally {
      setActionLoading(null)
    }
  }

  const refunds = data?.refunds ?? []

  return (
    <div className="space-y-4">
      {refunds.length === 0 && (
        <p className="text-zinc-500 text-sm py-8 text-center">
          {isVi ? 'Không có yêu cầu hoàn tiền nào.' : 'No refund requests.'}
        </p>
      )}
      {refunds.map((r) => (
        <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs text-zinc-500 font-mono">{r.purchase_id}</p>
              <p className="text-sm text-zinc-300 font-medium mt-0.5">{r.customer_wallet_address}</p>
              <p className="text-xs text-zinc-500 mt-0.5">${((r.amount_cents ?? 0) / 100).toFixed(2)} USDT</p>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${STATUS_BADGE[r.status] ?? ''}`}>
              {r.status.toUpperCase()}
            </span>
          </div>

          {r.reason && (
            <p className="text-sm text-zinc-400 bg-zinc-800/50 rounded p-2">
              {r.reason}
            </p>
          )}

          {r.refund_tx_hash && (
            <p className="text-xs text-emerald-400 font-mono">TX: {r.refund_tx_hash}</p>
          )}

          {r.status === 'pending' && (
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                placeholder={isVi ? 'Ghi chú (tùy chọn)' : 'Admin notes (optional)'}
                value={notesInputs[r.id] ?? ''}
                onChange={(e) => setNotesInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                className="flex-1 min-w-32 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
              />
              <button
                disabled={actionLoading === `${r.id}-approve`}
                onClick={() => doAction(r.id, 'approve', { adminNotes: notesInputs[r.id] })}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded font-medium disabled:opacity-50 transition-colors"
              >
                {isVi ? 'Chấp thuận' : 'Approve'}
              </button>
              <button
                disabled={actionLoading === `${r.id}-reject`}
                onClick={() => doAction(r.id, 'reject', { adminNotes: notesInputs[r.id] })}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded font-medium disabled:opacity-50 transition-colors"
              >
                {isVi ? 'Từ chối' : 'Reject'}
              </button>
            </div>
          )}

          {r.status === 'approved' && (
            <div className="flex gap-2 flex-wrap items-center">
              <input
                type="text"
                placeholder={isVi ? 'Mã giao dịch (tx hash) *' : 'Transaction hash *'}
                value={txHashInputs[r.id] ?? ''}
                onChange={(e) => setTxHashInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                className="flex-1 min-w-40 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 font-mono"
              />
              <button
                disabled={!txHashInputs[r.id] || actionLoading === `${r.id}-mark-refunded`}
                onClick={() => doAction(r.id, 'mark-refunded', { tx_hash: txHashInputs[r.id] })}
                className="px-3 py-1.5 bg-violet-700 hover:bg-violet-600 text-white text-xs rounded font-medium disabled:opacity-50 transition-colors"
              >
                {isVi ? 'Đánh dấu đã hoàn tiền' : 'Mark as Refunded'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
