/**
 * POST/GET/DELETE /api/affiliate/payout-method
 *
 * Manage USDT payout methods for authenticated affiliate.
 * POST: validate checksum, encrypt address, insert (verified=0).
 * GET: list methods (address masked — no plaintext exposed).
 * DELETE ?id=: remove method.
 *
 * @module app/api/affiliate/payout-method
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/seed/auth/better-auth-session'
import { getD1 } from '@/seed/db/client'
import { encryptSecret } from '@/tree/crypto/encrypt-secret'
import { validateUsdtAddress, type UsdtMethod } from '@/land/payouts/usdt-addr-validator'
import { logger } from '@/seed/utils/logger-utility'

const PostSchema = z.object({
  method: z.enum(['usdt_trc20', 'usdt_erc20', 'bank_account']),
  recipient_addr: z.string().min(1).max(200),
  displayLabel: z.string().max(100).optional(),
  setDefault: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { method, recipient_addr, displayLabel, setDefault } = parsed.data

  // Validate USDT address checksum (only for usdt_* methods)
  if (method === 'usdt_trc20' || method === 'usdt_erc20') {
    const isValid = await validateUsdtAddress(recipient_addr, method as UsdtMethod)
    if (!isValid) {
      return NextResponse.json(
        { error: `Invalid ${method === 'usdt_trc20' ? 'TRC20' : 'ERC20'} address` },
        { status: 422 },
      )
    }
  }

  const encKey = process.env.PAYOUT_ENC_KEY
  const encrypted = await encryptSecret(recipient_addr, encKey)

  const tenantId = user.id
  const affiliateId = user.id
  const _db = getD1();
  if (!_db) {
    logger.error('[Affiliate/PayoutMethod] D1 unavailable');
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  const db = _db;
  const id = `pm_${tenantId}_${Date.now()}`
  const now = Math.floor(Date.now() / 1000)

  try {
    if (setDefault) {
      await db
        .prepare(`UPDATE payout_methods SET is_default = 0 WHERE tenant_id = ? AND affiliate_id = ?`)
        .bind(tenantId, affiliateId)
        .run()
    }

    await db
      .prepare(
        `INSERT INTO payout_methods
         (id, tenant_id, affiliate_id, method, recipient_addr_encrypted,
          display_label, is_default, verified, created_at)
         VALUES (?,?,?,?,?,?,?,0,?)`,
      )
      .bind(id, tenantId, affiliateId, method, encrypted, displayLabel ?? null, setDefault ? 1 : 0, now)
      .run()
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Address already registered for this method' }, { status: 409 })
    }
    throw err
  }

  return NextResponse.json({ id, method, displayLabel, isDefault: setDefault, verified: false }, { status: 201 })
}

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = user.id
  const affiliateId = user.id
  const _db = getD1();
  if (!_db) {
    logger.error('[Affiliate/PayoutMethod/GET] D1 unavailable');
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  const db = _db;

  const result = await db
    .prepare(
      `SELECT id, method, display_label, is_default, verified, created_at
       FROM payout_methods
       WHERE tenant_id = ? AND affiliate_id = ?
       ORDER BY is_default DESC, created_at DESC`,
    )
    .bind(tenantId, affiliateId)
    .all<{
      id: string
      method: string
      display_label: string | null
      is_default: number
      verified: number
      created_at: number
    }>()

  return NextResponse.json({ methods: result.results ?? [] })
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
  }

  const tenantId = user.id
  const affiliateId = user.id
  const _db = getD1();
  if (!_db) {
    logger.error('[Affiliate/PayoutMethod/DELETE] D1 unavailable');
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }
  const db = _db;

  const result = await db
    .prepare(
      `DELETE FROM payout_methods
       WHERE id = ? AND tenant_id = ? AND affiliate_id = ?`,
    )
    .bind(id, tenantId, affiliateId)
    .run()

  if ((result.meta?.changes ?? 0) === 0) {
    return NextResponse.json({ error: 'Method not found' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}
