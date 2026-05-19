// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/e2e-smoke — End-to-end smoke test (admin only).
 * Hook E UI: synthetic IPN → fulfillment → email chain validation.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/e2e-smoke/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { E2ESmokeClient } from './e2e-smoke-client'

interface Props { params: Promise<{ locale: string }> }

export const metadata = { title: 'E2E Smoke Test | Admin | Sophia AI' }

export default async function E2ESmokePage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Kiểm Tra E2E Tổng Hợp' : 'E2E Smoke Test'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Kiểm tra toàn bộ chuỗi thanh toán → IPN → fulfillment → email mà không tốn tiền thật.'
            : 'Validates full chain: Pay → IPN → Queue → Render → Email without spending real money.'}
        </p>
      </div>
      <E2ESmokeClient locale={locale} />
    </div>
  )
}
