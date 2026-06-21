/**
 * /dashboard/admin/deploy-guard — Deploy approval management UI
 * Tasks #88, #92, #47
 *
 * Server Component. Enforces admin auth and renders client UI.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier'
import DeployGuardClient from './page.client'

interface PageProps {
  params: Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function DeployGuardPage({ params }: PageProps) {
  await params
  await requireMasterTier()

  // The locale is passed to client component for i18n
  const { locale } = await params

  return <DeployGuardClient locale={locale} />
}
