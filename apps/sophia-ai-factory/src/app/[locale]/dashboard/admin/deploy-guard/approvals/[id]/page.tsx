/**
 * /dashboard/admin/deploy-guard/approvals/[id] — Approval detail page
 * Tasks #88, #92, #47
 *
 * Server Component. Fetches approval details and renders client UI.
 */

import { requireMasterTier } from '@/seed/auth/require-master-tier'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { approvalService } from '@/forest/deploy-guard'
import DeployGuardApprovalDetail from './page.client'

interface PageProps {
  params: Promise<{ locale: string; id: string }>
}

export const dynamic = 'force-dynamic'

export default async function DeployGuardApprovalPage({ params }: PageProps) {
  await params
  await requireMasterTier()
  const { locale, id } = await params

  const approval = await approvalService.getApproval(id)
  if (!approval) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Approval not found</h1>
        <p className="text-muted-foreground">The requested approval does not exist.</p>
      </div>
    )
  }

  const user = await getCurrentUser()
  const userId = user?.id || 'unknown'

  return <DeployGuardApprovalDetail locale={locale} approval={approval} userId={userId} />
}
