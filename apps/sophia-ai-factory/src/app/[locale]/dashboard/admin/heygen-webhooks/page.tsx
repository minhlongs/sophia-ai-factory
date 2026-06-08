// ops-internal EN-only per docs/code-standards.md#admin-i18n-policy
/**
 * /dashboard/admin/heygen-webhooks — HeyGen webhook management (admin only).
 * Hook F UI: auto-register + debug listing.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/heygen-webhooks/page
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { HeyGenWebhooksClient } from './heygen-webhooks-client'

interface Props { params: Promise<{ locale: string }> }

export const dynamic = 'force-dynamic'
export const metadata = { title: 'HeyGen Webhooks | Admin | Sophia AI' }

export default async function HeyGenWebhooksPage({ params }: Props) {
  const { locale } = await params
  await requireMasterTier();

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-muted-foreground-100">
          {isVi ? 'Webhook HeyGen' : 'HeyGen Webhooks'}
        </h1>
        <p className="text-sm text-muted-foreground-400 mt-1">
          {isVi
            ? 'Đăng ký tự động webhook HeyGen khi lưu API key. Xem danh sách webhook của người dùng để gỡ lỗi.'
            : 'Auto-register HeyGen webhooks when saving API key. Debug endpoint listing per user.'}
        </p>
      </div>
      <HeyGenWebhooksClient locale={locale} />
    </div>
  )
}
