// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/actions — Admin manual actions console.
 * Admin-only. Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/actions/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { AdminActionsConsole } from './admin-actions-console'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = { title: 'Admin Actions | Sophia AI' }

export default async function AdminActionsPage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-muted-foreground-100">
          {isVi ? 'Bảng Điều Khiển Hành Động Admin' : 'Admin Actions Console'}
        </h1>
        <p className="text-sm text-muted-foreground-400 mt-1">
          {isVi
            ? 'Thực hiện các hành động thủ công trên tài khoản khách hàng'
            : 'Perform manual operations on customer accounts'}
        </p>
      </div>
      <AdminActionsConsole locale={locale} />
    </div>
  )
}
