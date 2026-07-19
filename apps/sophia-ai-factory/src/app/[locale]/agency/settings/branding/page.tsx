import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { redirect } from 'next/navigation'
import { findByOwner } from '@/seed/db/repositories/agency-repo'
import { getBranding } from '@/seed/db/repositories/agency-branding-repo'
import { BrandingClient } from './branding-client'

export const dynamic = 'force-dynamic'

export default async function AgencyBrandingSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const agency = await findByOwner(Number(user.id))
  if (!agency) {
    return <div className="max-w-2xl mx-auto py-12 px-4"><p className="text-muted-foreground">No agency found. Please register first.</p></div>
  }

  const branding = await getBranding(agency.id)

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-2">Branding Settings</h1>
      <p className="text-muted-foreground mb-8">Colors, logo, and brand information</p>
      <BrandingClient agencyId={agency.id} initial={branding} />
    </div>
  )
}
