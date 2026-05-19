// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/refunds — admin refund management page.
 * Lists all refund requests. Admin can approve/reject/mark-refunded.
 *
 * @module app/[locale]/dashboard/admin/refunds/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { AdminRefundTable } from './admin-refund-table'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = { title: 'Refund Management | Admin | Sophia AI' }

export default async function AdminRefundsPage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Quản Lý Hoàn Tiền' : 'Refund Management'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Xem xét và xử lý yêu cầu hoàn tiền từ khách hàng'
            : 'Review and process customer refund requests'}
        </p>
      </div>
      <AdminRefundTable locale={locale} />
    </div>
  )
}
