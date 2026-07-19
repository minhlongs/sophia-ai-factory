import { getTranslations } from 'next-intl/server'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { redirect } from 'next/navigation'
import { findByOwner } from '@/seed/db/repositories/agency-repo'
import { getCreditBalance } from '@/seed/db/repositories/agency-repo'
import { getBranding } from '@/seed/db/repositories/agency-branding-repo'
import { findByAgency } from '@/seed/db/repositories/sub-tenant-repo'
import { AGENCY_TIERS } from '@/seed/config/tiers/tier-configs'
import { DashboardShell } from '@/components/white-label/dashboard-shell'
import { CreditMeterDisplay } from '@/components/white-label/credit-meter-display'
import { SubTenantTable } from '@/components/white-label/sub-tenant-table'
import type { SubTenantRow } from '@/seed/db/repositories/sub-tenant-repo'

export const dynamic = 'force-dynamic'

export default async function AgencyDashboardPage() {
  const t = await getTranslations('agencyDashboard')
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const agency = await findByOwner(Number(user.id))
  if (!agency) redirect('/agency/onboarding')

  const [balance, branding, subTenantsRaw] = await Promise.all([
    getCreditBalance(agency.id),
    getBranding(agency.id),
    findByAgency(agency.id),
  ])

  const tierConfig = AGENCY_TIERS[agency.tier as keyof typeof AGENCY_TIERS] ?? AGENCY_TIERS.starter
  const subTenants = subTenantsRaw as SubTenantRow[]

  return (
    <DashboardShell branding={branding} agencyId={agency.id}>
      <h1 className="text-2xl font-bold mb-6">{t('title', { defaultMessage: 'Dashboard' })}</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">{t('credits', { defaultMessage: 'Credits' })}</h2>
        <div className="rounded-lg border bg-card p-4">
          <CreditMeterDisplay used={balance} total={tierConfig.monthlyCredits} />
          <p className="text-sm text-muted-foreground mt-2">
            Gói {agency.tier}: {tierConfig.monthlyCredits} credits/tháng • {tierConfig.maxSubTenants === Infinity ? '∞' : tierConfig.maxSubTenants} users tối đa
          </p>
        </div>
      </section>

      <section className="mb-8">
        <SubTenantTable subTenants={subTenants} onAdd={async () => {}} onRemove={async () => {}} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">{t('branding', { defaultMessage: 'Branding' })}</h2>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-3 mb-2">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.displayName} className="h-8" />
            ) : (
              <div className="h-8 w-8 rounded-md flex items-center justify-center text-white text-sm font-bold" style={{ background: branding.primaryColor }}>
                {branding.displayName.charAt(0)}
              </div>
            )}
            <span className="font-semibold">{branding.displayName}</span>
          </div>
          <p className="text-sm text-muted-foreground">{branding.taglineVi} / {branding.taglineEn}</p>
        </div>
      </section>
    </DashboardShell>
  )
}
