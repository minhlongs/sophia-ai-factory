import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { TIER_DB_MAPPING } from '@/seed/config/tiers';
import { writeAuditLog } from '@/tree/admin/audit-log';

export const VALID_TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'] as const;

export const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('grant_credits'),
    userEmail: z.string().email(),
    amount: z.number().int().positive().max(10000),
    reason: z.string().min(1).max(500),
  }),
  z.object({ action: z.literal('reset_tier'), userEmail: z.string().email(), tier: z.enum(VALID_TIERS) }),
  z.object({ action: z.literal('pause_user'), userEmail: z.string().email() }),
  z.object({ action: z.literal('resume_user'), userEmail: z.string().email() }),
  z.object({ action: z.literal('replay_ipn'), paymentId: z.string().min(1).max(200) }),
]);

export type AdminActionBody = z.infer<typeof bodySchema>;

interface UserRow { id: string; email: string }
interface PurchaseRow { id: string; credits_remaining: number }

async function findUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  return db.prepare('SELECT id, email FROM user WHERE email = ?1').bind(email).first<UserRow>();
}

async function handleGrantCredits(
  db: D1Database,
  actorUserId: string,
  body: Extract<AdminActionBody, { action: 'grant_credits' }>
): Promise<NextResponse> {
  const user = await findUserByEmail(db, body.userEmail);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const purchase = await db
    .prepare(`SELECT id, credits_remaining FROM user_purchases WHERE user_id = ?1 AND kind = 'one_time' ORDER BY created_at DESC LIMIT 1`)
    .bind(user.id)
    .first<PurchaseRow>();

  if (purchase) {
    await db.prepare('UPDATE user_purchases SET credits_remaining = credits_remaining + ?1 WHERE id = ?2').bind(body.amount, purchase.id).run();
  } else {
    const compId = crypto.randomUUID().replace(/-/g, '');
    await db
      .prepare(
        `INSERT INTO user_purchases (id, user_id, sku, kind, status, credits_remaining, paid_at, payment_id, amount_cents)
         VALUES (?1, ?2, 'COMPENSATION', 'one_time', 'paid', ?3, strftime('%s','now'), 'admin-grant', 0)`
      )
      .bind(compId, user.id, body.amount)
      .run();
  }

  await writeAuditLog({
    actorUserId,
    actionType: 'grant_credits',
    targetUserId: user.id,
    payload: { amount: body.amount, reason: body.reason, purchaseId: purchase?.id },
  });
  return NextResponse.json({ ok: true, message: `Granted ${body.amount} credits to ${user.email}` });
}

async function handleResetTier(
  db: D1Database,
  actorUserId: string,
  body: Extract<AdminActionBody, { action: 'reset_tier' }>
): Promise<NextResponse> {
  const user = await findUserByEmail(db, body.userEmail);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const dbPlan = TIER_DB_MAPPING[body.tier as keyof typeof TIER_DB_MAPPING] ?? 'basic';
  const orgId = await resolveOrgId(user.id, db);
  if (orgId) {
    await db.prepare("UPDATE subscriptions SET plan = ?1 WHERE org_id = ?2 AND status = 'active'").bind(dbPlan, orgId).run();
  }
  await writeAuditLog({ actorUserId, actionType: 'reset_tier', targetUserId: user.id, payload: { newTier: body.tier } });
  return NextResponse.json({ ok: true, message: `Tier reset to ${body.tier} for ${user.email}` });
}

async function handleUserStatus(
  db: D1Database,
  actorUserId: string,
  body: Extract<AdminActionBody, { action: 'pause_user' | 'resume_user' }>
): Promise<NextResponse> {
  const newStatus = body.action === 'pause_user' ? 'paused' : 'active';
  const user = await findUserByEmail(db, body.userEmail);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await db.prepare('UPDATE user SET status = ?1 WHERE id = ?2').bind(newStatus, user.id).run();
  await writeAuditLog({ actorUserId, actionType: body.action, targetUserId: user.id, payload: { status: newStatus } });
  return NextResponse.json({ ok: true, message: `User ${user.email} status set to ${newStatus}` });
}

async function handleReplayIpn(
  db: D1Database,
  actorUserId: string,
  body: Extract<AdminActionBody, { action: 'replay_ipn' }>
): Promise<NextResponse> {
  const purchase = await db
    .prepare(`SELECT id, user_id, sku, status FROM user_purchases WHERE payment_id = ?1 AND kind = 'one_time' LIMIT 1`)
    .bind(body.paymentId)
    .first<{ id: string; user_id: string; sku: string; status: string }>();

  if (!purchase) return NextResponse.json({ error: 'Purchase not found for paymentId' }, { status: 404 });

  await db.prepare(`UPDATE user_purchases SET status = 'paid' WHERE id = ?1`).bind(purchase.id).run();
  await writeAuditLog({
    actorUserId,
    actionType: 'replay_ipn',
    targetUserId: purchase.user_id,
    payload: { paymentId: body.paymentId, purchaseId: purchase.id },
  });
  return NextResponse.json({ ok: true, message: `IPN replayed — purchase ${purchase.id} reset to paid/pending` });
}

export async function executeAdminAction(db: D1Database, actorUserId: string, body: AdminActionBody): Promise<NextResponse> {
  if (body.action === 'grant_credits') return handleGrantCredits(db, actorUserId, body);
  if (body.action === 'reset_tier') return handleResetTier(db, actorUserId, body);
  if (body.action === 'pause_user' || body.action === 'resume_user') return handleUserStatus(db, actorUserId, body);
  if (body.action === 'replay_ipn') return handleReplayIpn(db, actorUserId, body);
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
