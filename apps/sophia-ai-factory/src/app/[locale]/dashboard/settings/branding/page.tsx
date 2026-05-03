/**
 * /dashboard/settings/branding — Per-user email branding settings.
 * Stored as JSON in user_provider_credentials provider='email_branding'.
 * Bilingual Vi/En.
 *
 * @module app/[locale]/dashboard/settings/branding/page
 */

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/better-auth-session'
import { EmailBrandingForm } from './email-branding-form'

interface Props {
  params: Promise<{ locale: string }>
}

export const metadata = { title: 'Email Branding | Sophia AI' }

export default async function BrandingPage({ params }: Props) {
  const { locale } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/${locale}/login`)

  const isVi = locale.startsWith('vi')

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {isVi ? 'Thương Hiệu Email' : 'Email Branding'}
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          {isVi
            ? 'Tuỳ chỉnh tên người gửi và logo hiển thị trong email gửi đến khách hàng của bạn.'
            : 'Customize the sender name and logo shown in emails sent to your customers.'}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <EmailBrandingForm locale={locale} userId={user.id} />
      </div>

      <p className="text-xs text-zinc-600">
        {isVi
          ? '* Nếu để trống, hệ thống sẽ dùng thương hiệu mặc định của Sophia AI.'
          : '* If left empty, Sophia AI default branding will be used.'}
      </p>
    </div>
  )
}
