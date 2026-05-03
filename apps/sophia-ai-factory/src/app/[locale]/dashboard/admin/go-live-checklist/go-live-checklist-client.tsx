'use client'

/**
 * Go-live checklist client component — polls /api/admin/go-live-status.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/go-live-checklist/go-live-checklist-client
 */

import useSWR from 'swr'
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface CheckResult {
  key: string
  label_vi: string
  label_en: string
  pass: boolean
  detail?: string
}

interface StatusResponse {
  checks: CheckResult[]
  timestamp: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<StatusResponse>)

interface Props { locale: string }

export function GoLiveChecklist({ locale }: Props) {
  const isVi = locale.startsWith('vi')
  const { data, isLoading, mutate } = useSWR<StatusResponse>(
    '/api/admin/go-live-status',
    fetcher,
    { refreshInterval: 60000 },
  )

  const checks = data?.checks ?? []
  const passCount = checks.filter((c) => c.pass).length
  const total = checks.length
  const allGreen = total > 0 && passCount === total

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className={`text-sm font-medium ${allGreen ? 'text-emerald-400' : 'text-amber-400'}`}>
          {isLoading
            ? (isVi ? 'Đang kiểm tra...' : 'Checking...')
            : `${passCount}/${total} ${isVi ? 'kiểm tra thành công' : 'checks passing'}`}
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {isVi ? 'Làm mới' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-2">
        {checks.map((check) => (
          <div
            key={check.key}
            className={`flex items-start gap-3 p-4 rounded-xl border ${check.pass ? 'border-emerald-900/40 bg-emerald-950/20' : 'border-red-900/40 bg-red-950/20'}`}
          >
            <div className="shrink-0 mt-0.5">
              {check.pass
                ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                : <XCircle className="w-4 h-4 text-red-400" />}
            </div>
            <div>
              <p className="text-sm text-zinc-200">{isVi ? check.label_vi : check.label_en}</p>
              {check.detail && (
                <p className="text-xs text-zinc-500 mt-0.5">{check.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {data?.timestamp && (
        <p className="text-xs text-zinc-600 text-right">
          {isVi ? 'Cập nhật lúc' : 'Updated at'}: {new Date(data.timestamp * 1000).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}
