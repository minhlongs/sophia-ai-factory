/**
 * /dashboard/admin/actions — Admin manual actions console.
 * Admin-only. Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/actions/page
 */

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/better-auth-session'
import { AdminActionsConsole } from './admin-actions-console'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = { title: 'Admin Actions | Sophia AI' }

export default async function AdminActionsPage({ params }: Props) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)
  if (user.role !== 'admin') redirect(`/${locale}/dashboard`)

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Bảng Điều Khiển Hành Động Admin' : 'Admin Actions Console'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Thực hiện các hành động thủ công trên tài khoản khách hàng'
            : 'Perform manual operations on customer accounts'}
        </p>
      </div>
      <AdminActionsConsole locale={locale} />
    </div>
  )
}
