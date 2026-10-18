/**
 * Route handler logic for /api/affiliate/payout-method
 * Layer: app/api/affiliate/payout-method
 * @module app/api/affiliate/payout-method/payout-method-route-handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { encryptSecret } from '@/tree/crypto/encrypt-secret';
import { validateUsdtAddress, type UsdtMethod } from '@/land/payouts/usdt-addr-validator';
import {
  PostSchema,
  insertPayoutMethod,
  listPayoutMethods,
} from './payout-method-helpers';
import { authenticateAndGetDb } from './payout-method-auth';

export async function handleCreatePayoutMethod(request: NextRequest) {
  const auth = await authenticateAndGetDb();
  if ('error' in auth) return auth.error;
  const { user, db } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { method, recipient_addr, displayLabel, setDefault } = parsed.data;

  if (method === 'usdt_trc20' || method === 'usdt_erc20') {
    const isValid = await validateUsdtAddress(recipient_addr, method as UsdtMethod);
    if (!isValid) {
      return NextResponse.json(
        { error: `Invalid ${method === 'usdt_trc20' ? 'TRC20' : 'ERC20'} address` },
        { status: 422 },
      );
    }
  }

  const encKey = process.env.PAYOUT_ENC_KEY;
  const encrypted = await encryptSecret(recipient_addr, encKey);

  const id = `pm_${user.id}_${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);

  try {
    await insertPayoutMethod(db, {
      id,
      tenantId: user.id,
      affiliateId: user.id,
      method,
      encrypted,
      displayLabel,
      setDefault,
      now,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Address already registered for this method' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ id, method, displayLabel, isDefault: setDefault, verified: false }, { status: 201 });
}

export async function handleListPayoutMethods() {
  const auth = await authenticateAndGetDb();
  if ('error' in auth) return auth.error;
  const { user, db } = auth;

  const methods = await listPayoutMethods(db, user.id, user.id);
  return NextResponse.json({ methods });
}

export async function handleDeletePayoutMethod(request: NextRequest) {
  const auth = await authenticateAndGetDb();
  if ('error' in auth) return auth.error;
  const { user, db } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }

  const result = await db
    .prepare(`DELETE FROM payout_methods WHERE id = ? AND tenant_id = ? AND affiliate_id = ?`)
    .bind(id, user.id, user.id)
    .run();

  if ((result.meta?.changes ?? 0) === 0) {
    return NextResponse.json({ error: 'Method not found' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}