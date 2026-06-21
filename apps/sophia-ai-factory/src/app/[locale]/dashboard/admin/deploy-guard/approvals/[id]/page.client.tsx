/**
 * Deploy Guard Approval Detail — Client Component
 * Tasks #88, #92, #47
 */

'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, CheckCircle, Clock, XCircle, Shield } from 'lucide-react'

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
  updatedAt: number
  diff_summary?: string
  files_changed?: number
  attestations: Array<{ id: string; operatorId: string; signature: string; operatorHost: string; signedAt: number }>
  remainingAttestations: number
}

interface Props {
  locale: string
  approval: Approval
}

export default function DeployGuardApprovalDetail({ locale, approval: initialApproval }: Props) {
  const isVi = locale.startsWith('vi')
  const [approval, setApproval] = useState(initialApproval)
  const [attesting, setAttesting] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const remaining = approval.requiredAttestations - approval.attestationCount

  const fetchUpdated = async () => {
    const res = await fetch(`/api/admin/deploy-guard/approvals/${approval.id}`)
    if (res.ok) {
      const data = await res.json()
      setApproval(data)
    }
  }

  const handleAttest = async () => {
    if (!confirm(isVi ? 'Bạn có chắc? Hành động này sẽ ký chữ ký với DEPLOY_KEY của bạn.' : 'Are you sure? This will sign the deploy manifest with your DEPLOY_KEY.')) return
    setAttesting(true)
    try {
      const manifest = {
        commit_sha: approval.commitSha,
        branch: approval.branch,
        timestamp: new Date().toISOString(),
        operator_host: window.location.hostname,
        operator_user: 'admin', // TODO: get actual user ID
        diff_summary: approval.diff_summary || '',
        files_changed: approval.files_changed || 0,
        required_attestations: approval.requiredAttestations
      }

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

      const res = await fetch('/api/admin/deploy-guard/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: approval.id, signature })
      })

      if (res.ok) {
        setToast({ message: isVi ? 'Đã ghi nhận chữ ký' : 'Attestation recorded', type: 'success' })
        await fetchUpdated()
      } else {
        const err = await res.json()
        setToast({ message: err.error || (isVi ? 'Ghi nhận thất bại' : 'Attestation failed'), type: 'error' })
      }
    } catch (error) {
      setToast({ message: isVi ? 'Lỗi chữ ký' : 'Attestation error', type: 'error' })
    } finally {
      setAttesting(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setRejecting(true)
    try {
      const res = await fetch('/api/admin/deploy-guard/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId: approval.id, reason: rejectReason })
      })
      if (res.ok) {
        setToast({ message: isVi ? 'Đã từ chối approval' : 'Approval rejected', type: 'success' })
        setRejectReason('')
        await fetchUpdated()
      } else {
        const err = await res.json()
        setToast({ message: err.error || (isVi ? 'Từ chối thất bại' : 'Rejection failed'), type: 'error' })
      }
    } catch (error) {
      setToast({ message: isVi ? 'Lỗi từ chối' : 'Rejection error', type: 'error' })
    } finally {
      setRejecting(false)
    }
  }

  const formatTime = (ts: number) => {
    try {
      return formatDistanceToNow(new Date(ts * 1000), { addSuffix: true })
    } catch {
      return 'Invalid date'
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary-400"
      >
        <ArrowLeft className="w-4 h-4" />
        {isVi ? 'Quay lại' : 'Back to list'}
      </button>

      <header className="flex items-start gap-3">
        <Shield className="w-6 h-6 text-primary-400 mt-1 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">
            {isVi ? 'Chi tiết Approval' : 'Approval Details'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isVi ? `Deployment cho commit ${approval.commitSha.slice(0, 8)}` : `Deployment for commit ${approval.commitSha.slice(0, 8)}`}
          </p>
        </div>
      </header>

      {toast && (
        <div className={`rounded-lg p-4 ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-200 border border-emerald-500/30' : 'bg-red-500/10 text-red-200 border border-red-500/30'}`}>
          {toast.message}
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{isVi ? 'Thông tin cơ bản' : 'Basic Information'}</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{isVi ? 'Commit' : 'Commit'}</dt>
              <dd className="font-mono text-primary-300">{approval.commitSha.slice(0, 8)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{isVi ? 'Branch' : 'Branch'}</dt>
              <dd>{approval.branch}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{isVi ? 'Operator' : 'Operator'}</dt>
              <dd>{approval.operatorUser}@{approval.operatorHost}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{isVi ? 'Trạng thái' : 'Status'}</dt>
              <dd className={`inline-flex items-center gap-1 ${approval.status === 'approved' ? 'text-emerald-400' : approval.status === 'rejected' ? 'text-red-400' : approval.status === 'pending' ? 'text-yellow-400' : ''}`}>
                {approval.status === 'approved' && <CheckCircle className="w-4 h-4" />}
                {approval.status === 'rejected' && <XCircle className="w-4 h-4" />}
                {approval.status === 'pending' && <Clock className="w-4 h-4" />}
                {approval.status.toUpperCase()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{isVi ? 'Thay đổi' : 'Changes'}</dt>
              <dd>{approval.files_changed ?? 0} {isVi ? 'file' : 'files'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{isVi ? 'Tạo lúc' : 'Created'}</dt>
              <dd>{formatTime(approval.createdAt)}</dd>
            </div>
          </dl>

          {approval.diff_summary && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">{isVi ? 'Diff Summary' : 'Diff Summary'}</h3>
              <pre className="bg-muted-900 p-3 rounded text-xs overflow-x-auto">
                {approval.diff_summary}
              </pre>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">{isVi ? 'Attestations' : 'Attestations'}</h2>
          {approval.attestations.length === 0 ? (
            <p className="text-muted-foreground text-sm">{isVi ? 'Chưa có attestation nào.' : 'No attestations yet.'}</p>
          ) : (
            <ul className="space-y-2">
              {approval.attestations.map((att) => (
                <li key={att.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono">{att.operatorId}</span>
                  <span className="text-muted-foreground">@{att.operatorHost}</span>
                  <span className="text-muted-foreground text-xs">{formatTime(att.signedAt)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-sm">
              {isVi
                ? `Cần ${remaining} chữ ký thêm để đạt quorum.`
                : `Need ${remaining} more attestation${remaining !== 1 ? 's' : ''} to reach quorum.`}
            </p>
          </div>

          {approval.status === 'pending' && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-lg font-semibold">{isVi ? 'Hành động' : 'Actions'}</h3>
              <div className="flex flex-col gap-2">
                {remaining > 0 && (
                  <button
                    onClick={handleAttest}
                    disabled={attesting}
                    className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded disabled:opacity-50"
                  >
                    {attesting ? (isVi ? 'Đang ký...' : 'Signing...') : isVi ? 'Chứng thực (Attest)' : 'Attest'}
                  </button>
                )}
                <button
                  onClick={() => setRejecting(!rejecting)}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded"
                >
                  {isVi ? 'Từ chối Approval' : 'Reject Approval'}
                </button>
              </div>

              {rejecting && (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-2 bg-muted-900 border border-border-800 rounded text-sm"
                    rows={3}
                    placeholder={isVi ? 'Lý do từ chối...' : 'Rejection reason...'}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={!rejectReason.trim() || rejecting}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded disabled:opacity-50"
                    >
                      {rejecting ? (isVi ? 'Đang gửi...' : 'Submitting...') : isVi ? 'Xác nhận từ chối' : 'Confirm Rejection'}
                    </button>
                    <button
                      onClick={() => { setRejecting(false); setRejectReason('') }}
                      className="px-4 py-2 bg-muted-700 hover:bg-muted-600 rounded"
                    >
                      {isVi ? 'Hủy' : 'Cancel'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
