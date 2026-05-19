// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/go-live-checklist — system readiness checklist (admin only).
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/go-live-checklist/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { GoLiveChecklist } from './go-live-checklist-client'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = { title: 'Go-Live Checklist | Admin | Sophia AI' }

export default async function GoLiveChecklistPage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Checklist Ra Mắt' : 'Go-Live Checklist'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Kiểm tra sức khoẻ hệ thống trước khi ra mắt chính thức.'
            : 'Verify system health before official launch.'}
        </p>
      </div>
      <GoLiveChecklist locale={locale} />
    </div>
  )
}
