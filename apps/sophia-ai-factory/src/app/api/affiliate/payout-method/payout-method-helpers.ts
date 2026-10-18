import { z } from 'zod'
import { getD1 } from '@/seed/db/client'

export const PostSchema = z.object({
  method: z.enum(['usdt_trc20', 'usdt_erc20', 'bank_account']),
  recipient_addr: z.string().min(1).max(200),
  displayLabel: z.string().max(100).optional(),
  setDefault: z.boolean().optional().default(false),
})

export type PayoutMethodRow = {
  id: string
  method: string
  display_label: string | null
  is_default: number
  verified: number
  created_at: number
}

export async function insertPayoutMethod(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  params: {
    id: string
    tenantId: string
    affiliateId: string
    method: string
    encrypted: string
    displayLabel?: string
    setDefault: boolean
    now: number
  },
) {
  if (params.setDefault) {
    await db
      .prepare(`UPDATE payout_methods SET is_default = 0 WHERE tenant_id = ? AND affiliate_id = ?`)
      .bind(params.tenantId, params.affiliateId)
      .run()
  }

  await db
    .prepare(
      `INSERT INTO payout_methods
       (id, tenant_id, affiliate_id, method, recipient_addr_encrypted,
        display_label, is_default, verified, created_at)
       VALUES (?,?,?,?,?,?,?,0,?)`,
    )
    .bind(
      params.id,
      params.tenantId,
      params.affiliateId,
      params.method,
      params.encrypted,
      params.displayLabel ?? null,
      params.setDefault ? 1 : 0,
      params.now,
    )
    .run()
}

export async function listPayoutMethods(
  db: NonNullable<Awaited<ReturnType<typeof getD1>>>,
  tenantId: string,
  affiliateId: string,
): Promise<PayoutMethodRow[]> {
  const result = await db
    .prepare(
      `SELECT id, method, display_label, is_default, verified, created_at
       FROM payout_methods
       WHERE tenant_id = ? AND affiliate_id = ?
       ORDER BY is_default DESC, created_at DESC`,
    )
    .bind(tenantId, affiliateId)
    .all<PayoutMethodRow>()

  return result.results ?? []
}
