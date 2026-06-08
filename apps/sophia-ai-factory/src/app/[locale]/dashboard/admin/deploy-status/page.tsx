// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/deploy-status — deploy & service health (admin only).
 * Hook H UI: last deploy SHA, cron health, service connectivity.
 * Honest about GH Actions limitation.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/deploy-status/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { DeployStatusClient } from './deploy-status-client'

interface Props { params: Promise<{ locale: string }> }

export const metadata = { title: 'Deploy Status | Admin | Sophia AI' }

export default async function DeployStatusPage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-muted-foreground-100">
          {isVi ? 'Trạng Thái Deploy' : 'Deploy Status'}
        </h1>
        <p className="text-sm text-muted-foreground-400 mt-1">
          {isVi
            ? 'SHA deploy cuối, sức khoẻ cron, kết nối dịch vụ, hướng dẫn CI/CD.'
            : 'Last deploy SHA, cron health, service connectivity, CI/CD guidance.'}
        </p>
      </div>
      <DeployStatusClient locale={locale} />
    </div>
  )
}
