/**
 * POST /api/admin/actions — admin manual action executor.
 * Handles: grant_credits, reset_tier, pause_user, resume_user, replay_ipn.
 *
 * @module app/api/admin/actions/route
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/seed/auth/require-admin'
import { TIER_DB_MAPPING } from '@/seed/config/tiers'
import { getD1Raw } from '@/seed/db/client'
import { writeAuditLog } from '@/tree/admin/audit-log'
import { logger } from '@/seed/utils/logger-utility'
import { getErrorMessage } from '@/seed/utils/to-error'

export const dynamic = 'force-dynamic'

const VALID_TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('grant_credits'),
    userEmail: z.string().email(),
    amount: z.number().int().positive().max(10000),
    reason: z.string().min(1).max(500),
  }),
  z.object({
    action: z.literal('reset_tier'),
    userEmail: z.string().email(),
    tier: z.enum(VALID_TIERS),
  }),
  z.object({
    action: z.literal('pause_user'),
    userEmail: z.string().email(),
  }),
  z.object({
    action: z.literal('resume_user'),
    userEmail: z.string().email(),
  }),
  z.object({
    action: z.literal('replay_ipn'),
    paymentId: z.string().min(1).max(200),
  }),
])

interface UserRow { id: string; email: string }
interface PurchaseRow { id: string; credits_remaining: number }

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request)
  if (auth instanceof NextResponse) return auth

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request', details: getErrorMessage(err) }, { status: 400 })
  }

  const db = await getD1Raw()

  try {
    if (body.action === 'grant_credits') {
      const user = await db.prepare('SELECT id, email FROM user WHERE email = ?1').bind(body.userEmail).first<UserRow>()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      const purchase = await db
        .prepare(`SELECT id, credits_remaining FROM user_purchases WHERE user_id = ?1 AND kind = 'one_time' ORDER BY created_at DESC LIMIT 1`)
        .bind(user.id)
        .first<PurchaseRow>()

      if (purchase) {
        await db
          .prepare('UPDATE user_purchases SET credits_remaining = credits_remaining + ?1 WHERE id = ?2')
          .bind(body.amount, purchase.id)
          .run()
      } else {
        // Create a compensation purchase record
        const compId = crypto.randomUUID().replace(/-/g, '')
        await db
          .prepare(
            `INSERT INTO user_purchases (id, user_id, sku, kind, status, credits_remaining, paid_at, payment_id, amount_cents)
             VALUES (?1, ?2, 'COMPENSATION', 'one_time', 'paid', ?3, strftime('%s','now'), 'admin-grant', 0)`,
          )
          .bind(compId, user.id, body.amount)
          .run()
      }

      await writeAuditLog({
        actorUserId: auth.user.id,
        actionType: 'grant_credits',
        targetUserId: user.id,
        payload: { amount: body.amount, reason: body.reason, purchaseId: purchase?.id },
      })
      return NextResponse.json({ ok: true, message: `Granted ${body.amount} credits to ${user.email}` })
    }

    if (body.action === 'reset_tier') {
      const user = await db.prepare('SELECT id, email FROM user WHERE email = ?1').bind(body.userEmail).first<UserRow>()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      // Update subscription plan via org_members → subscriptions
      const dbPlan = TIER_DB_MAPPING[body.tier as keyof typeof TIER_DB_MAPPING] ?? 'basic'
      const member = await db.prepare('SELECT org_id FROM org_members WHERE user_id = ?1 LIMIT 1').bind(user.id).first<{ org_id: string }>()
      if (member) {
        await db.prepare("UPDATE subscriptions SET plan = ?1 WHERE org_id = ?2 AND status = 'active'").bind(dbPlan, member.org_id).run()
      }
      await writeAuditLog({
        actorUserId: auth.user.id,
        actionType: 'reset_tier',
        targetUserId: user.id,
        payload: { newTier: body.tier },
      })
      return NextResponse.json({ ok: true, message: `Tier reset to ${body.tier} for ${user.email}` })
    }

    if (body.action === 'pause_user' || body.action === 'resume_user') {
      const newStatus = body.action === 'pause_user' ? 'paused' : 'active'
      const user = await db.prepare('SELECT id, email FROM user WHERE email = ?1').bind(body.userEmail).first<UserRow>()
      if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

      await db.prepare('UPDATE user SET status = ?1 WHERE id = ?2').bind(newStatus, user.id).run()
      await writeAuditLog({
        actorUserId: auth.user.id,
        actionType: body.action === 'pause_user' ? 'pause_user' : 'resume_user',
        targetUserId: user.id,
        payload: { status: newStatus },
      })
      return NextResponse.json({ ok: true, message: `User ${user.email} status set to ${newStatus}` })
    }

    if (body.action === 'replay_ipn') {
      // Call the existing handleOneTimeFinished path via the IPN handler
      // The admin provides the payment_id; we look up the purchase and re-trigger fulfillment
      const purchase = await db
        .prepare(`SELECT id, user_id, sku, status FROM user_purchases WHERE payment_id = ?1 AND kind = 'one_time' LIMIT 1`)
        .bind(body.paymentId)
        .first<{ id: string; user_id: string; sku: string; status: string }>()

      if (!purchase) return NextResponse.json({ error: 'Purchase not found for paymentId' }, { status: 404 })

      // Reset to paid so fulfillment runner can pick it up
      await db
        .prepare(`UPDATE user_purchases SET status = 'paid' WHERE id = ?1`)
        .bind(purchase.id)
        .run()

      await writeAuditLog({
        actorUserId: auth.user.id,
        actionType: 'replay_ipn',
        targetUserId: purchase.user_id,
        payload: { paymentId: body.paymentId, purchaseId: purchase.id },
      })
      return NextResponse.json({ ok: true, message: `IPN replayed — purchase ${purchase.id} reset to paid/pending` })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    logger.error('[AdminActions] Failed', err instanceof Error ? err : undefined, { action: (body as { action: string }).action })
    return NextResponse.json({ error: 'internal_error', details: getErrorMessage(err) }, { status: 500 })
  }
}
