/**
 * /dashboard/admin/deploy-guard — Deploy approval management UI
 * Tasks #88, #92, #47
 *
 * Client component. Renders the approval management interface.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Shield, CheckCircle, XCircle, AlertTriangle, Clock, History, Eye } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { ApprovalDetailDto } from '@/forest/deploy-guard'
import { logger } from '@/seed/utils/logger-utility'

interface Approval {
  id: string
  commitSha: string
  branch: string
  operatorHost: string
  operatorUser: string
  status: string
  attestationCount: number
  requiredAttestations: number
  createdAt: number
  attestations: Array<{ operatorId: string }>
  diff_summary?: string
  files_changed?: number
}

interface HistoryEntry {
  id: string
  event: string
  commit_sha?: string
  operator_id?: string
  created_at: number
  payload?: any
}

interface DeployGuardClientProps {
  locale: string
  userId: string
}

export default function DeployGuardClient({ locale, userId }: DeployGuardClientProps) {
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [attestingId, setAttestingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [overrideCommit, setOverrideCommit] = useState<string | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const isVi = locale.startsWith('vi')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetch('/api/admin/deploy-guard/pending?limit=50').then(r => r.json()),
        fetch('/api/admin/deploy-guard/history?limit=50').then(r => r.json())
      ])
      setPendingApprovals((pendingRes as { approvals: Approval[] }).approvals || [])
      setHistory((historyRes as { entries: HistoryEntry[] }).entries || [])
    } catch (error) {
      logger.error('Failed to fetch deploy-guard data', error instanceof Error ? error : { error: String(error) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
    // Poll every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleAttest = async (approvalId: string) => {
    if (!confirm(isVi ? 'Bạn có chắc? Hành động này sẽ ký chữ ký với DEPLOY_KEY của bạn.' : 'Are you sure? This will sign the deploy manifest with your DEPLOY_KEY.')) return

    setAttestingId(approvalId)
    try {
      // Get approval details to compute manifest
      const approvalRes = await fetch(`/api/admin/deploy-guard/approvals/${approvalId}`)
      const approval = (await approvalRes.json()) as Approval

      // Build manifest (must match deploy-with-sha.sh structure)
      const manifest = {
        commit_sha: approval.commitSha,
        branch: approval.branch,
        timestamp: new Date().toISOString(),
        operator_host: window.location.hostname,
        operator_user: userId,
        diff_summary: approval.diff_summary || '',
        files_changed: approval.files_changed || 0,
        required_attestations: approval.requiredAttestations
      }

      // Compute signature using DEPLOY_KEY from env (client-side)
      // Note: In production, operator's DEPLOY_KEY should be set in browser env or via secure input
      const secret = (window as any).DEPLOY_KEY || process.env?.DEPLOY_KEY
      if (!secret) {
        setToast({ message: isVi ? 'DEPLOY_KEY chưa được cấu hình' : 'DEPLOY_KEY not configured', type: 'error' })
        return
      }

      const { subtle } = crypto
      const encoder = new TextEncoder()
      const key = await subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      const manifestStr = JSON.stringify(manifest, Object.keys(manifest).sort())
      const sigBuffer = await subtle.sign('HMAC', key, encoder.encode(manifestStr))
      const signature = Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

      // Send attestation
      const res = await fetch('/api/admin/deploy-guard/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, signature })
      })

      if (res.ok) {
        setToast({ message: isVi ? 'Đã ghi nhận chữ ký' : 'Attestation recorded', type: 'success' })
        await fetchData()
      } else {
        const err = (await res.json()) as { error?: string }
        setToast({ message: err.error || (isVi ? 'Ghi nhận thất bại' : 'Attestation failed'), type: 'error' })
      }
    } catch (error) {
      setToast({ message: isVi ? 'Lỗi chữ ký' : 'Attestation error', type: 'error' })
    } finally {
      setAttestingId(null)
    }
  }

  const handleReject = async (approvalId: string) => {
    if (!rejectReason.trim()) {
      setToast({ message: isVi ? 'Vui lòng nhập lý do từ chối' : 'Please provide a rejection reason', type: 'error' })
      return
    }

    setRejectingId(approvalId)
    try {
      const res = await fetch('/api/admin/deploy-guard/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, reason: rejectReason })
      })

      if (res.ok) {
        setToast({ message: isVi ? 'Đã từ chối approval' : 'Approval rejected', type: 'success' })
        setRejectingId(null)
        setRejectReason('')
        await fetchData()
      } else {
        const err = (await res.json()) as { error?: string }
        setToast({ message: err.error || (isVi ? 'Từ chối thất bại' : 'Rejection failed'), type: 'error' })
      }
    } catch (error) {
      setToast({ message: isVi ? 'Lỗi từ chối' : 'Rejection error', type: 'error' })
    } finally {
      setRejectingId(null)
    }
  }

  const handleOverride = async () => {
    if (!overrideCommit || !overrideReason.trim()) return

    try {
      const res = await fetch('/api/admin/deploy-guard/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commitSha: overrideCommit, reason: overrideReason })
      })

      if (res.ok) {
        setToast({ message: isVi ? 'Đã ghi nhận override — deploy được cho phép' : 'Override recorded — deploy allowed', type: 'success' })
        setOverrideCommit(null)
        setOverrideReason('')
        await fetchData()
      } else {
        const err = (await res.json()) as { error?: string }
        setToast({ message: err.error || (isVi ? 'Override thất bại' : 'Override failed'), type: 'error' })
      }
    } catch (error) {
      setToast({ message: isVi ? 'Lỗi override' : 'Override error', type: 'error' })
    }
  }

  const formatTime = (ts: number) => {
    try {
      return formatDistanceToNow(new Date(ts * 1000), { addSuffix: true })
    } catch {
      return 'Invalid date'
    }
  }

  if (loading && pendingApprovals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">
          {isVi ? 'Đang tải approvals...' : 'Loading deploy approvals...'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-3">
        <Shield className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold">
            {isVi ? 'Deploy Guard' : 'Deploy Guard'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isVi
              ? 'Quản lý deployment approvals, operator attestations, và emergency overrides.'
              : 'Manage deployment approvals, operator attestations, and emergency overrides.'}
          </p>
        </div>
      </header>

      {toast && (
        <div className={`rounded-lg p-4 ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30' : 'bg-red-500/10 text-red-200 border border-red-500/30'}`}>
          {toast.message}
        </div>
      )}

      {/* Pending Approvals */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isVi ? 'Pending Approvals' : 'Pending Approvals'}
          </h2>
          <span className="text-sm text-muted-foreground">
            {pendingApprovals.length} {isVi ? 'chờ xử lý' : 'pending'}
          </span>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="rounded-lg border border-border-800 bg-muted-900/30 p-8 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {isVi ? 'Không có deployments chờ approval.' : 'No deployments pending approval.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Commit' : 'Commit'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Branch' : 'Branch'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Operator' : 'Operator'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Attestations' : 'Attestations'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Created' : 'Created'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Actions' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-800">
                {pendingApprovals.map((approval) => {
                  const remaining = approval.requiredAttestations - approval.attestationCount
                  const isUrgent = remaining > 0 && approval.createdAt < Math.floor(Date.now() / 1000) - 3600
                  return (
                    <tr key={approval.id} className={isUrgent ? 'bg-orange-500/5' : ''}>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted-800 px-2 py-1 rounded font-mono text-primary-300">
                          {approval.commitSha.slice(0, 8)}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground-300">{approval.branch}</td>
                      <td className="px-4 py-3 text-muted-foreground-300">{approval.operatorUser}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {remaining === 0 ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-400" />
                          )}
                          <span className={remaining === 0 ? 'text-emerald-400' : 'text-yellow-400'}>
                            {approval.attestationCount}/{approval.requiredAttestations}
                          </span>
                          {remaining > 0 && (
                            <span className="text-xs text-muted-foreground-500">
                              ({isVi ? `cần ${remaining}` : `needs ${remaining}`})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground-500 text-xs">
                        {formatTime(approval.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => window.open(`/dashboard/admin/deploy-guard/approvals/${approval.id}`, '_blank')}
                            className="text-xs px-2 py-1 bg-muted-700 hover:bg-muted-600 rounded text-muted-foreground-300 flex items-center gap-1 w-fit"
                          >
                            <Eye className="w-3 h-3" />
                            {isVi ? 'Chi tiết' : 'Details'}
                          </button>
                          <div className="flex gap-2">
                            {remaining > 0 && (
                              <button
                                onClick={() => handleAttest(approval.id)}
                                disabled={attestingId === approval.id}
                                className="text-xs px-2 py-1 bg-primary-600 hover:bg-primary-500 text-white rounded disabled:opacity-50"
                              >
                                {attestingId === approval.id ? (isVi ? 'Đang ký...' : 'Signing...') : isVi ? 'Chứng thực' : 'Attest'}
                              </button>
                            )}
                            <button
                              onClick={() => setRejectingId(rejectingId === approval.id ? null : approval.id)}
                              className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded"
                            >
                              {isVi ? 'Từ chối' : 'Reject'}
                            </button>
                          </div>
                          {rejectingId === approval.id && (
                            <div className="space-y-2 mt-1">
                              <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                className="w-full p-2 bg-muted-900 border border-border-800 rounded text-xs"
                                rows={2}
                                placeholder={isVi ? 'Lý do từ chối...' : 'Rejection reason...'}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReject(approval.id)}
                                  disabled={!rejectReason.trim()}
                                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
                                >
                                  {isVi ? 'Xác nhận' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => { setRejectingId(null); setRejectReason('') }}
                                  className="text-xs px-2 py-1 bg-muted-700 hover:bg-muted-600 rounded"
                                >
                                  {isVi ? 'Hủy' : 'Cancel'}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Emergency Override */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          {isVi ? 'Emergency Override' : 'Emergency Override'}
        </h2>
        <div className="rounded-lg border border-red-900/30 bg-red-500/5 p-4">
          <p className="text-sm text-muted-foreground mb-3">
            {isVi
              ? 'Bypass deploy guard cho deployment khẩn cấp. Cần có lý do được ghi chú.'
              : 'Bypass deploy guard for an urgent deployment. Requires documented reason.'}
          </p>
          {overrideCommit ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">
                  {isVi ? 'Lý do Override' : 'Reason for Override'}
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full p-2 bg-muted-900 border border-border-800 rounded text-sm"
                  rows={3}
                  placeholder={isVi
                    ? 'Mô tả tại sao cần emergency override...'
                    : 'Describe why this emergency override is needed...'}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleOverride}
                  disabled={!overrideReason.trim()}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded disabled:opacity-50"
                >
                  {isVi ? 'Xác nhận Override' : 'Confirm Override'}
                </button>
                <button
                  onClick={() => { setOverrideCommit(null); setOverrideReason('') }}
                  className="px-3 py-1.5 bg-muted-700 hover:bg-muted-600 text-sm rounded"
                >
                  {isVi ? 'Hủy' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={isVi ? 'Commit SHA (ví dụ: abc1234)' : 'Commit SHA (e.g., abc1234)'}
                className="flex-1 p-2 bg-muted-900 border border-border-800 rounded text-sm font-mono"
                onKeyDown={(e) => e.key === 'Enter' && setOverrideCommit(e.currentTarget.value)}
              />
              <button
                onClick={() => {
                  const input = document.querySelector('input[type="text"]') as HTMLInputElement
                  if (input?.value) setOverrideCommit(input.value)
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
              >
                Override
              </button>
            </div>
          )}
        </div>
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          {isVi ? 'Lịch sử gần đây' : 'Recent History'}
        </h2>
        {history.length === 0 ? (
          <div className="rounded-lg border border-border-800 bg-muted-900/30 p-8 text-center">
            <p className="text-muted-foreground">
              {isVi ? 'Chưa có hoạt động deploy guard.' : 'No deploy guard activity yet.'}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted-900/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Thời gian' : 'Time'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Hành động' : 'Action'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Commit' : 'Commit'}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground-400">
                    {isVi ? 'Operator' : 'Operator'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-800">
                {history.slice(0, 50).map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-muted-foreground-500 text-xs">
                      {formatTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                        entry.event === 'overridden' ? 'bg-red-500/20 text-red-300' :
                        entry.event === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-muted-800 text-muted-foreground-300'
                      }`}>
                        {entry.event}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.commit_sha && (
                        <code className="text-xs bg-muted-800 px-2 py-1 rounded font-mono">
                          {entry.commit_sha.slice(0, 8)}
                        </code>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground-300 text-xs">
                      {entry.operator_id || 'system'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
