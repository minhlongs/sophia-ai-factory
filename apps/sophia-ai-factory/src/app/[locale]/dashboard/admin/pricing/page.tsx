/**
 * /dashboard/admin/pricing — SKU price override editor (admin only).
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/pricing/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { AdminPricingEditor } from './admin-pricing-editor'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = { title: 'Pricing Overrides | Admin | Sophia AI' }

export default async function AdminPricingPage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Quản Lý Giá SKU' : 'SKU Pricing Overrides'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Thay đổi giá SKU mà không cần sửa code. Giá DB ưu tiên hơn giá mặc định.'
            : 'Override SKU prices without code changes. DB prices take priority over defaults.'}
        </p>
      </div>
      <AdminPricingEditor locale={locale} />
    </div>
  )
}
