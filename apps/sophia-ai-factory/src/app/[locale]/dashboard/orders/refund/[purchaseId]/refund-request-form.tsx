'use client'

/**
 * Client form component for submitting a refund request.
 * Bilingual Vi/En via locale prop.
 *
 * @module app/[locale]/dashboard/orders/refund/[purchaseId]/refund-request-form
 */

import { useState } from 'react'

interface Props {
  purchaseId: string
  locale: string
}

export function RefundRequestForm({ purchaseId, locale }: Props) {
  const isVi = locale.startsWith('vi')
  const [reason, setReason] = useState('')
  const [wallet, setWallet] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/refund-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, reason, customerWalletAddress: wallet }),
      })
      const data = await res.json() as Record<string, unknown>
      if (res.ok) {
        setResult({
          ok: true,
          message: isVi
            ? 'Yêu cầu đã được gửi thành công! Chúng tôi sẽ liên hệ qua email trong vòng 24 giờ.'
            : 'Request submitted! We will contact you via email within 24 hours.',
        })
      } else {
        setResult({
          ok: false,
          message: (data.error as string) ?? (isVi ? 'Có lỗi xảy ra' : 'An error occurred'),
        })
      }
    } catch {
      setResult({ ok: false, message: isVi ? 'Lỗi kết nối' : 'Connection error' })
    } finally {
      setLoading(false)
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-lg bg-emerald-950/40 border border-emerald-800 p-4 text-emerald-300 text-sm">
        {result.message}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-zinc-300 mb-1">
          {isVi ? 'Lý do yêu cầu hoàn tiền *' : 'Reason for refund *'}
        </label>
        <textarea
          required
          minLength={10}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder={isVi ? 'Mô tả lý do bạn muốn hoàn tiền...' : 'Describe why you need a refund...'}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm text-zinc-300 mb-1">
          {isVi ? 'Địa chỉ ví TRC20 (USDT) *' : 'TRC20 wallet address (USDT) *'}
        </label>
        <input
          required
          minLength={10}
          maxLength={200}
          type="text"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          placeholder={isVi ? 'TRC20 địa chỉ ví của bạn...' : 'Your TRC20 wallet address...'}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
        />
      </div>

      {result && !result.ok && (
        <p className="text-sm text-red-400">{result.message}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        {loading
          ? (isVi ? 'Đang gửi...' : 'Submitting...')
          : (isVi ? 'Gửi yêu cầu hoàn tiền' : 'Submit refund request')}
      </button>
    </form>
  )
}
