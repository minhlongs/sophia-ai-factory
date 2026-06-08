// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/ops — Ops visibility dashboard (admin only).
 *
 * Server component: auth gate, then delegates to OpsSnapshotCard client component
 * for SWR-based polling.
 *
 * Redirects non-admins to /dashboard.
 *
 * @module app/[locale]/dashboard/admin/ops/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { OpsSnapshotCard } from './ops-snapshot-card'
import { Activity } from 'lucide-react'

interface OpsPageProps {
  params: Promise<{ locale: string }>
}

export const metadata = {
  title: 'Ops Dashboard | Sophia AI',
  description: 'Real-time go-live health snapshot for admins',
}

export default async function OpsPage({ params }: OpsPageProps) {
  const { locale } = await params
  const isVi = locale.startsWith('vi')

  await requireMasterTier();

  const title = isVi ? 'Bảng Điều Khiển Vận Hành' : 'Ops Dashboard'
  const subtitle = isVi
    ? 'Theo dõi sức khỏe hệ thống theo thời gian thực trước khi ra mắt'
    : 'Real-time system health snapshot before go-live'

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Activity className="w-6 h-6 text-primary-400 mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-muted-foreground-100">{title}</h1>
          <p className="text-sm text-muted-foreground-400 mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border-800 bg-muted-900/50 p-1">
        <div className="rounded-lg bg-muted-950/60 p-4">
          <p className="text-xs text-muted-foreground-500 mb-4">
            {isVi
              ? 'Dữ liệu tự động làm mới mỗi 30 giây. Chỉ hiển thị cho admin.'
              : 'Auto-refreshes every 30 seconds. Visible to admins only.'}
          </p>
          <OpsSnapshotCard locale={locale} />
        </div>
      </div>

      <div className="rounded-xl border border-border-800 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground-300">
          {isVi ? 'Hành động nhanh' : 'Quick Actions'}
        </h2>
        <div className="flex flex-wrap gap-2">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint, not navigation; admin shortcut. Refactor to <button onClick={fetch}> tracked separately. */}
          <a
            href="/api/admin/circuit-breaker/reset"
            data-method="POST"
            className="text-xs px-3 py-1.5 bg-muted-800 hover:bg-muted-700 text-muted-foreground-300 rounded-lg transition-colors"
          >
            {isVi ? 'Reset Circuit Breaker' : 'Reset Circuit Breaker'}
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint, not navigation; admin shortcut. Refactor to <button onClick={fetch}> tracked separately. */}
          <a
            href="/api/admin/run-synthetic-fulfillment"
            className="text-xs px-3 py-1.5 bg-primary-900/50 hover:bg-primary-800/60 text-primary-300 rounded-lg transition-colors"
          >
            {isVi ? 'Chạy kiểm tra tổng hợp' : 'Run Synthetic E2E'}
          </a>
        </div>
      </div>
    </div>
  )
}
