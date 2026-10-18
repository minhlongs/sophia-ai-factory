/**
 * Sandbox Reuse & Reactivation Helper
 * Layer: tree/sales/sandbox
 *
 * @module tree/sales/sandbox/sandbox-reuse-helper
 */

import type { D1Database } from '@/seed/db/client'
import type { EnterpriseDeal, SandboxProvisionResult } from '@/seed/types/enterprise-deal'
import { getSubaccountById } from '@/tree/organizations/subaccount-repo'
import { updateEnterpriseDeal } from '../enterprise-deal-repo'
import { generateSandboxToken } from './crypto-tokens'

export interface ReuseSandboxParams {
  db: D1Database
  deal: EnterpriseDeal
  demoMcu: number
  expiresAt: number
  secret: string
  baseUrl: string
}

/**
 * Checks if a deal already has a provisioned sandbox subaccount and re-activates it.
 */
export async function tryReuseExistingSandbox(
  params: ReuseSandboxParams
): Promise<SandboxProvisionResult | null> {
  const { db, deal, demoMcu, expiresAt, secret, baseUrl } = params
  if (!deal.sandboxSubaccountId) return null

  const existingSubaccount = await getSubaccountById(db, deal.sandboxSubaccountId)
  if (!existingSubaccount) return null

  const token = await generateSandboxToken(
    { dealId: deal.id, subaccountId: existingSubaccount.id, expiresAt },
    secret
  )
  const demoMagicUrl = `${baseUrl}/sandbox/${token}`

  await updateEnterpriseDeal(db, deal.id, {
    sandboxStatus: 'active',
    sandboxToken: token,
    sandboxExpiresAt: expiresAt,
    dealStage:
      deal.dealStage === 'new_lead' || deal.dealStage === 'qualified'
        ? 'demo_active'
        : deal.dealStage,
  })

  return {
    dealId: deal.id,
    subaccountId: existingSubaccount.id,
    subaccountName: existingSubaccount.name,
    slug: existingSubaccount.slug,
    allocatedMcu: demoMcu,
    expiresAt,
    sandboxToken: token,
    demoMagicUrl,
    watermarkEnabled: true,
  }
}
