/**
 * POST /api/admin/pricing/update — set/update a SKU price override (admin only).
 *
 * @module app/api/admin/pricing/update/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin'
import { setSkuPrice } from '@/seed/config/pricing-resolver'
import { writeAuditLog } from '@/tree/admin/audit-log'
import { getErrorMessage } from '@/seed/utils/to-error'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  sku: z.string().min(1).max(100),
  price_cents: z.number().int().positive().max(10_000_00),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request)
  if (auth instanceof NextResponse) return auth

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid body', details: getErrorMessage(err) }, { status: 400 })
  }

  await setSkuPrice(body.sku, body.price_cents, auth.user.id)

  await writeAuditLog({
    actorUserId: auth.user.id,
    actionType: 'pricing_override_set',
    payload: { sku: body.sku, price_cents: body.price_cents },
  })

  return NextResponse.json({ ok: true, sku: body.sku, price_cents: body.price_cents })
}
