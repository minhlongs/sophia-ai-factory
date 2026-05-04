'use client'

/**
 * Admin pricing editor — table of SKUs with inline price editing.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/pricing/admin-pricing-editor
 */

import { useState } from 'react'
import useSWR from 'swr'

interface SkuRow {
  sku: string
  default_price_cents: number
  effective_price_cents: number
  override: { price_cents: number; enabled: number } | null
  label_vi: string
  label_en: string
}

interface ListResponse { skus: SkuRow[] }

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<ListResponse>)

interface Props { locale: string }

export function AdminPricingEditor({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const { data, mutate } = useSWR<ListResponse>('/api/admin/pricing/list', fetcher, { refreshInterval: 0 })
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saveResult, setSaveResult] = useState<Record<string, string>>({})

  async function saveOverride(sku: string) {
    const raw = editValues[sku]
    if (!raw) return
    const priceCents = Math.round(parseFloat(raw) * 100)
    if (isNaN(priceCents) || priceCents <= 0) return

    setSaving(sku)
    try {
      const res = await fetch('/api/admin/pricing/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, price_cents: priceCents }),
      })
      const d = await res.json() as Record<string, unknown>
      setSaveResult((p) => ({ ...p, [sku]: res.ok ? (isVi ? 'Đã lưu' : 'Saved') : String(d.error ?? 'error') }))
      await mutate()
    } finally {
      setSaving(null)
    }
  }

  const skus = data?.skus ?? []

  return (
    <div className="rounded-xl border border-zinc-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900 border-b border-zinc-800">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">SKU</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
              {isVi ? 'Mặc định' : 'Default'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
              {isVi ? 'Hiện tại' : 'Effective'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
              {isVi ? 'Giá mới (USD)' : 'New Price (USD)'}
            </th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {skus.map((row) => (
            <tr key={row.sku} className="bg-zinc-950/40 hover:bg-zinc-900/40 transition-colors">
              <td className="px-4 py-3">
                <p className="font-mono text-zinc-200 text-xs">{row.sku}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{isVi ? row.label_vi : row.label_en}</p>
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">
                ${(row.default_price_cents / 100).toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium ${row.override ? 'text-violet-300' : 'text-zinc-400'}`}>
                  ${(row.effective_price_cents / 100).toFixed(2)}
                  {row.override && <span className="ml-1 text-violet-500">(override)</span>}
                </span>
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder={(row.effective_price_cents / 100).toFixed(2)}
                  value={editValues[row.sku] ?? ''}
                  onChange={(e) => setEditValues((p) => ({ ...p, [row.sku]: e.target.value }))}
                  className="w-28 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => saveOverride(row.sku)}
                    disabled={saving === row.sku || !editValues[row.sku]}
                    className="px-3 py-1 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-xs rounded font-medium transition-colors"
                  >
                    {saving === row.sku ? '…' : (isVi ? 'Lưu' : 'Save')}
                  </button>
                  {saveResult[row.sku] && (
                    <span className="text-xs text-emerald-400">{saveResult[row.sku]}</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {skus.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-sm">
                {isVi ? 'Đang tải...' : 'Loading...'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
