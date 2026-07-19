import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { redirect } from 'next/navigation'
import { OnboardingClient } from './onboarding-client'

export const dynamic = 'force-dynamic'

export default async function AgencyOnboardingPage() {
  const t = await getTranslations('agencyOnboarding')
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">{t('title', { defaultMessage: 'Tạo Agency Mới' })}</h1>
      <p className="text-muted-foreground mb-8">{t('subtitle', { defaultMessage: 'Thiết lập thương hiệu và cấu hình ban đầu' })}</p>
      <OnboardingClient />
    </div>
  )
}
