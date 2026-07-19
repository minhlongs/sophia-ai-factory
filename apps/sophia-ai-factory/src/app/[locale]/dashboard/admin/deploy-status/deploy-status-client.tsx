'use client'

/**
 * Deploy Status admin UI — Hook H.
 * Shows last deploy SHA/time, cron health, service connectivity.
 * Honest about GH Actions disabled (account-level, cannot auto-restore from code).
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/deploy-status/deploy-status-client
 */

import { useState, useEffect, useCallback } from 'react'

interface Props { locale: string }

interface DeployStatus {
  deploy: {
    sha: string | null
    deployedAt: string | null
    branch: string | null
  }
  cron: {
    healthy: boolean
    lastFiredAt: number | null
    lastFiredIso: string | null
    secondsSinceLast: number | null
  }
  services: {
    heygen: boolean
    nowpayments: boolean
    supabase: boolean
  }
  cicd: {
    enabled: boolean
    note: string
    manualDeployCmd: string
  }
  timestamp: number
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
  )
}

export function DeployStatusClient({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const [data, setData] = useState<DeployStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/deploy-status')
      if (res.ok) setData(await res.json() as DeployStatus)
    } catch {
      // no-op
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function copyCmd(cmd: string) {
    try {
      await navigator.clipboard.writeText(cmd)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = cmd
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!data && loading) {
    return <p className="text-sm text-muted-foreground-500">{isVi ? 'Đang tải...' : 'Loading...'}</p>
  }

  if (!data) return null

  const { deploy, cron, services, cicd } = data

  return (
    <div className="space-y-4">
      {/* Deploy info */}
      <div className="rounded-xl border border-border-800 bg-muted-900/50 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground-200">
            {isVi ? 'Thông tin deploy' : 'Last Deploy'}
          </h2>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs text-muted-foreground-500 hover:text-muted-foreground-300 transition-colors"
          >
            {isVi ? 'Tải lại' : 'Refresh'}
          </button>
        </div>
        {deploy.sha ? (
          <div className="space-y-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground-500 w-24">SHA:</span>
              <code className="text-primary-400 font-mono">{deploy.sha}</code>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground-500 w-24">{isVi ? 'Thời gian:' : 'Deployed:'}</span>
              <span className="text-muted-foreground-300">{deploy.deployedAt}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground-500 w-24">Branch:</span>
              <span className="text-muted-foreground-300">{deploy.branch}</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground-500">
            {isVi
              ? 'Chưa có thông tin deploy (chạy deploy-with-sha.sh để cập nhật).'
              : 'No deploy metadata found. Run deploy-with-sha.sh to populate.'}
          </p>
        )}
      </div>

      {/* Cron health */}
      <div className="rounded-xl border border-border-800 bg-muted-900/50 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground-200">{isVi ? 'Cron health' : 'Cron Health'}</h2>
        <div className="flex items-center gap-2 text-sm">
          <StatusDot ok={cron.healthy} />
          <span className={cron.healthy ? 'text-emerald-400' : 'text-red-400'}>
            {cron.healthy
              ? (isVi ? 'Hoạt động bình thường' : 'Healthy')
              : (isVi ? 'Chưa chạy trong 5 phút qua' : 'Not fired in last 5 min')}
          </span>
        </div>
        {cron.lastFiredIso && (
          <p className="text-xs text-muted-foreground-500">
            {isVi ? 'Lần cuối:' : 'Last:'} {cron.lastFiredIso}
            {cron.secondsSinceLast !== null && ` (${cron.secondsSinceLast}s ago)`}
          </p>
        )}
      </div>

      {/* Services */}
      <div className="rounded-xl border border-border-800 bg-muted-900/50 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground-200">{isVi ? 'Dịch vụ' : 'Services'}</h2>
        <div className="space-y-2 text-sm">
          {[
            { key: 'heygen', label: 'HeyGen API Key', ok: services.heygen },
            { key: 'nowpayments', label: 'NOWPayments IPN Secret', ok: services.nowpayments },
            { key: 'supabase', label: 'Supabase URL', ok: services.supabase },
          ].map(({ key, label, ok }) => (
            <div key={key} className="flex items-center gap-2">
              <StatusDot ok={ok} />
              <span className="text-muted-foreground-300">{label}</span>
              <span className={`text-xs ${ok ? 'text-emerald-500' : 'text-red-500'}`}>
                {ok ? (isVi ? 'Đã cấu hình' : 'Configured') : (isVi ? 'Thiếu' : 'Missing')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CI/CD — honest limitation */}
      <div className="rounded-xl border border-red-900/50 bg-muted-900/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StatusDot ok={false} />
          <h2 className="text-sm font-semibold text-red-400">
            {isVi ? 'GitHub Actions (bị vô hiệu hóa)' : 'GitHub Actions (Disabled)'}
          </h2>
        </div>
        <p className="text-xs text-muted-foreground-400">{cicd.note}</p>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground-500 font-medium">
            {isVi ? 'Lệnh deploy thủ công:' : 'Manual deploy command:'}
          </p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-muted-800 px-3 py-2 rounded-lg text-primary-300 font-mono break-all">
              {cicd.manualDeployCmd}
            </code>
            <button
              onClick={() => copyCmd(cicd.manualDeployCmd)}
              className="px-3 py-1 text-xs bg-muted-700 hover:bg-muted-600 text-muted-foreground-300 rounded-lg shrink-0"
            >
              {copied ? (isVi ? 'Đã sao chép!' : 'Copied!') : (isVi ? 'Sao chép' : 'Copy')}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground-600">
          {isVi
            ? 'Để khôi phục: mở https://github.com/settings/billing → kiểm tra giới hạn Actions → hoặc liên hệ GitHub Support.'
            : 'To restore: open https://github.com/settings/billing → check Actions usage → or contact GitHub Support.'}
        </p>
      </div>
    </div>
  )
}
