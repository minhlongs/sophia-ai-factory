/**
 * POST /api/sop/installations/[id]/regen-secret — rotate webhook HMAC secret.
 *
 * Generates new 32-byte random secret, overwrites encrypted column.
 * Returns { webhookSecret } plaintext ONCE (Stripe-style: show-once).
 * Auth + ownership check required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getInstallation, updateCustomizations } from '@/lib/sop/sop-repo';
import { generateWebhookSecret } from '@/lib/sop/webhook-hmac';
import { getSopD1 } from '@/lib/sop/d1';
import type { SopCustomizations } from '@/lib/sop/sop-types';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const inst = await getInstallation(db, id);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (inst.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const newSecret = generateWebhookSecret();

  const existing: SopCustomizations = inst.customizations
    ? (JSON.parse(inst.customizations) as SopCustomizations)
    : {};

  const merged: SopCustomizations = { ...existing, webhookSecret: newSecret };
  await updateCustomizations(db, id, merged);

  // Return new secret plaintext once — caller must store it securely
  return NextResponse.json({ webhookSecret: newSecret });
}
