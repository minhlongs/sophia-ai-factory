'use client'

/**
 * Admin actions console — grant credits, reset tier, pause/resume, synthetic, replay IPN.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/actions/admin-actions-console
 */

import { useState } from 'react'

interface Props { locale: string }

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const

interface ActionResult { ok: boolean; message: string }

export function AdminActionsConsole({ locale }: Props) {
  const isVi = locale.startsWith('vi')

  const [email, setEmail] = useState('')
  const [creditAmount, setCreditAmount] = useState(5)
  const [creditReason, setCreditReason] = useState('')
  const [tier, setTier] = useState<string>('BASIC')
  const [paymentId, setPaymentId] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)

  async function callAction(payload: Record<string, unknown>) {
    const action = String(payload.action)
    setLoading(action)
    setResult(null)
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as ActionResult & { error?: string }
      setResult({ ok: res.ok, message: data.message ?? data.error ?? (isVi ? 'Có lỗi xảy ra' : 'Error occurred') })
    } catch {
      setResult({ ok: false, message: isVi ? 'Lỗi kết nối' : 'Connection error' })
    } finally {
      setLoading(null)
    }
  }

  async function runSynthetic() {
    setLoading('synthetic')
    setResult(null)
    try {
      const res = await fetch('/api/admin/run-synthetic-fulfillment', { method: 'POST' })
      const data = await res.json() as Record<string, unknown>
      setResult({ ok: res.ok, message: res.ok ? (isVi ? 'Đã chạy kiểm tra tổng hợp' : 'Synthetic run triggered') : String(data.error ?? 'error') })
    } catch {
      setResult({ ok: false, message: isVi ? 'Lỗi kết nối' : 'Connection error' })
    } finally {
      setLoading(null)
    }
  }

  function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
        {children}
      </div>
    )
  }

  const Input = ({ value, onChange, placeholder, type = 'text' }: { value: string | number; onChange: (v: string) => void; placeholder: string; type?: string }) => (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
    />
  )

  const Btn = ({ label, action, disabled }: { label: string; action: () => void; disabled?: boolean }) => (
    <button
      onClick={action}
      disabled={!!loading || disabled}
      className="px-4 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
    >
      {loading ? '…' : label}
    </button>
  )

  return (
    <div className="space-y-4">
      {result && (
        <div className={`rounded-lg border p-3 text-sm ${result.ok ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-red-800 bg-red-950/30 text-red-300'}`}>
          {result.message}
        </div>
      )}

      <Card title={isVi ? 'Cấp thêm credits' : 'Grant Credits'}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={email} onChange={setEmail} placeholder={isVi ? 'Email khách hàng' : 'Customer email'} />
          <Input value={creditAmount} onChange={(v) => setCreditAmount(Number(v))} placeholder={isVi ? 'Số credits' : 'Credits amount'} type="number" />
        </div>
        <Input value={creditReason} onChange={setCreditReason} placeholder={isVi ? 'Lý do cấp credits' : 'Reason for granting credits'} />
        <Btn
          label={isVi ? 'Cấp credits' : 'Grant Credits'}
          action={() => callAction({ action: 'grant_credits', userEmail: email, amount: creditAmount, reason: creditReason })}
          disabled={!email || !creditReason || creditAmount <= 0}
        />
      </Card>

      <Card title={isVi ? 'Đặt lại tier' : 'Reset Tier'}>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={email} onChange={setEmail} placeholder={isVi ? 'Email khách hàng' : 'Customer email'} />
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <Btn
          label={isVi ? 'Đặt lại tier' : 'Reset Tier'}
          action={() => callAction({ action: 'reset_tier', userEmail: email, tier })}
          disabled={!email}
        />
      </Card>

      <Card title={isVi ? 'Tạm dừng / Kích hoạt lại tài khoản' : 'Pause / Resume Account'}>
        <Input value={email} onChange={setEmail} placeholder={isVi ? 'Email khách hàng' : 'Customer email'} />
        <div className="flex gap-2">
          <Btn label={isVi ? 'Tạm dừng' : 'Pause'} action={() => callAction({ action: 'pause_user', userEmail: email })} disabled={!email} />
          <button
            onClick={() => callAction({ action: 'resume_user', userEmail: email })}
            disabled={!!loading || !email}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {isVi ? 'Kích hoạt lại' : 'Resume'}
          </button>
        </div>
      </Card>

      <Card title={isVi ? 'Chạy kiểm tra tổng hợp' : 'Run Synthetic E2E'}>
        <p className="text-xs text-zinc-500">
          {isVi ? 'Chạy toàn bộ quy trình fulfillment với dữ liệu tổng hợp.' : 'Run full fulfillment pipeline with synthetic data.'}
        </p>
        <Btn label={isVi ? 'Chạy kiểm tra' : 'Run Synthetic'} action={runSynthetic} />
      </Card>

      <Card title={isVi ? 'Phát lại IPN thanh toán' : 'Replay Payment IPN'}>
        <p className="text-xs text-zinc-500">
          {isVi ? 'Dùng khi khách đã thanh toán nhưng IPN bị mất.' : 'Use when customer paid but IPN was lost.'}
        </p>
        <Input value={paymentId} onChange={setPaymentId} placeholder={isVi ? 'Payment ID (NOWPayments)' : 'Payment ID (NOWPayments)'} />
        <Btn
          label={isVi ? 'Phát lại IPN' : 'Replay IPN'}
          action={() => callAction({ action: 'replay_ipn', paymentId })}
          disabled={!paymentId}
        />
      </Card>
    </div>
  )
}
