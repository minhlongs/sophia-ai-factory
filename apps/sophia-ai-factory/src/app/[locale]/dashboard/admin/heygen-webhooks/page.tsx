/**
 * /dashboard/admin/heygen-webhooks — HeyGen webhook management (admin only).
 * Hook F UI: auto-register + debug listing.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/admin/heygen-webhooks/page
 */

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { HeyGenWebhooksClient } from './heygen-webhooks-client'

interface Props { params: Promise<{ locale: string }> }

export const metadata = { title: 'HeyGen Webhooks | Admin | Sophia AI' }

export default async function HeyGenWebhooksPage({ params }: Props) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)
  if (user.role !== 'admin') redirect(`/${locale}/dashboard`)

  const isVi = locale.startsWith('vi')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Webhook HeyGen' : 'HeyGen Webhooks'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Đăng ký tự động webhook HeyGen khi lưu API key. Xem danh sách webhook của người dùng để gỡ lỗi.'
            : 'Auto-register HeyGen webhooks when saving API key. Debug endpoint listing per user.'}
        </p>
      </div>
      <HeyGenWebhooksClient locale={locale} />
    </div>
  )
}
