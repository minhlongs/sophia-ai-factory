/**
 * Demo Sandbox Provisioner
 * Layer: tree/sales/sandbox
 */

import type { D1Database } from '@/seed/db/client'
import type { SandboxProvisionResult } from '@/seed/types/enterprise-deal'
import { logger } from '@/seed/utils/logger-utility'
import {
  createSubaccount,
  getSubaccountById,
  slugify,
} from '@/tree/organizations/subaccount-repo'
import {
  getEnterpriseDealById,
  updateEnterpriseDeal,
} from '../enterprise-deal-repo'
import {
  DEFAULT_BASE_URL,
  DEFAULT_DEMO_MCU,
  DEFAULT_EXPIRY_DAYS,
  DEFAULT_SECRET,
  type ProvisionDemoSandboxOptions,
} from './types'
import { generateSandboxToken } from './crypto-tokens'
import { resolveHostAgencyOrg } from './host-org-resolver'

/**
 * 1-Click activation of an isolated, 1,000 MCU sandboxed demo workspace for a deal.
 */
export async function provisionDemoSandbox(
  db: D1Database,
  dealId: string,
  options: ProvisionDemoSandboxOptions = {}
): Promise<SandboxProvisionResult> {
  const deal = await getEnterpriseDealById(db, dealId)
  if (!deal) {
    throw new Error(`Enterprise deal not found: ${dealId}`)
  }

  const demoMcu = options.demoMcu ?? DEFAULT_DEMO_MCU
  const expiryDays = options.expiryDays ?? DEFAULT_EXPIRY_DAYS
  const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000
  const secret = options.secret ?? DEFAULT_SECRET
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL

  const agencyOrgId = await resolveHostAgencyOrg(db, options.hostAgencyOrgId)

  // If already provisioned, reuse or re-activate
  if (deal.sandboxSubaccountId) {
    const existingSubaccount = await getSubaccountById(db, deal.sandboxSubaccountId)
    if (existingSubaccount) {
      const token = await generateSandboxToken(
        { dealId, subaccountId: existingSubaccount.id, expiresAt },
        secret
      )
      const demoMagicUrl = `${baseUrl}/sandbox/${token}`

      await updateEnterpriseDeal(db, dealId, {
        sandboxStatus: 'active',
        sandboxToken: token,
        sandboxExpiresAt: expiresAt,
        dealStage: deal.dealStage === 'new_lead' || deal.dealStage === 'qualified' ? 'demo_active' : deal.dealStage,
      })

      return {
        dealId,
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
  }

  // Generate unique subaccount slug
  const baseSlug = slugify(deal.companyName)
  const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 6)
  const subaccountSlug = `demo-${baseSlug.slice(0, 20)}-${randomSuffix}`
  const subaccountName = `${deal.companyName} Sandbox Demo`

  // Create isolated subaccount via existing subaccount repo
  const subaccount = await createSubaccount(db, {
    agencyOrgId,
    name: subaccountName,
    slug: subaccountSlug,
    initialMcu: demoMcu,
    branding: {
      logoUrl: undefined,
      primaryColor: '#0f172a',
      accentColor: '#10b981',
    },
  })

  // Generate HMAC demo token
  const sandboxToken = await generateSandboxToken(
    { dealId, subaccountId: subaccount.id, expiresAt },
    secret
  )
  const demoMagicUrl = `${baseUrl}/sandbox/${sandboxToken}`

  // Update deal record with sandbox linkage and progress stage to demo_active
  await updateEnterpriseDeal(db, dealId, {
    sandboxSubaccountId: subaccount.id,
    sandboxStatus: 'active',
    sandboxToken,
    sandboxExpiresAt: expiresAt,
    dealStage: deal.dealStage === 'new_lead' || deal.dealStage === 'qualified' || deal.dealStage === 'demo_prepared'
      ? 'demo_active'
      : deal.dealStage,
    metadata: {
      ...deal.metadata,
      demoProvisionedAt: Date.now(),
      demoMcuAllocated: demoMcu,
      watermarkEnforced: true,
    },
  })

  logger.info('[sandbox-provisioner] Successfully provisioned demo workspace', {
    dealId,
    subaccountId: subaccount.id,
    slug: subaccountSlug,
    allocatedMcu: demoMcu,
  })

  return {
    dealId,
    subaccountId: subaccount.id,
    subaccountName,
    slug: subaccountSlug,
    allocatedMcu: demoMcu,
    expiresAt,
    sandboxToken,
    demoMagicUrl,
    watermarkEnabled: true,
  }
}
