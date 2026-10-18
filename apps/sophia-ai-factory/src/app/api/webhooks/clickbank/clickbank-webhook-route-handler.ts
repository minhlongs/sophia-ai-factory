/**
 * ClickBank INS Webhook — core route handler logic.
 * Layer: app/api/webhooks/clickbank
 * @module app/api/webhooks/clickbank/clickbank-webhook-route-handler
 */

import { NextResponse } from 'next/server';
import { verifyClickBankSignature } from '@/land/affiliates/clickbank-signature-verifier';
import { parsePostback } from '@/land/affiliates/clickbank-postback-parser';
import { attributeClick } from '@/land/affiliates/conversion-attributor';
import { calcCommission } from '@/land/affiliates/commission-calculator';
import { checkRateLimit } from '@/tree/telegram/sql-rate-limiter';
import { logger } from '@/seed/utils/logger-utility';
import {
  resolvePayout,
  getD1Binding,
} from './clickbank-webhook-helpers';
import { checkDuplicateConversion, insertConversionRecord } from './clickbank-webhook-db';
import { handlePostInsertNotifications } from './clickbank-webhook-notify';

export async function handleClickBankWebhook(request: Request): Promise<NextResponse> {
  const CLICKBANK_INS_SECRET = process.env.CLICKBANK_INS_SECRET;
  if (!CLICKBANK_INS_SECRET) {
    logger.error('[clickbank-webhook] CLICKBANK_INS_SECRET not configured');
    return NextResponse.json({ ok: false, reason: 'config' }, { status: 200 });
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const rl = await checkRateLimit(`clickbank:${ip}`, 1000, 60);
  if (!rl.allowed) {
    logger.warn('[clickbank-webhook] rate limited', { ip });
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-clickbank-signature') ?? '';

  const isValid = await verifyClickBankSignature(rawBody, signature, CLICKBANK_INS_SECRET);
  if (!isValid) {
    logger.warn('[clickbank-webhook] invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const postback = parsePostback(rawBody);
  if (!postback) {
    logger.warn('[clickbank-webhook] unparseable postback body');
    return NextResponse.json({ ok: true, skipped: 'parse_error' }, { status: 200 });
  }

  const { receipt, transactionType, amount, currency, cvendthru } = postback;
  const db = getD1Binding();

  if (!db) {
    logger.error('[clickbank-webhook] D1 binding unavailable');
    return NextResponse.json({ ok: true, skipped: 'db_unavailable' }, { status: 200 });
  }

  if (await checkDuplicateConversion(db, receipt, transactionType)) {
    logger.info('[clickbank-webhook] duplicate receipt skipped', { receipt });
    return NextResponse.json({ ok: true, skipped: 'duplicate' }, { status: 200 });
  }

  const attribution = cvendthru ? await attributeClick(cvendthru) : null;
  const attributed = attribution !== null;
  const isReversal = transactionType === 'REFUND' || transactionType === 'CHARGEBACK';
  const grossAmount = isReversal ? -Math.abs(amount) : amount;

  const { user: commissionUser, sophia: commissionSophia } = calcCommission(grossAmount);
  const { payout_status, available_at } = resolvePayout(transactionType, attributed);

  const id = crypto.randomUUID();

  const insertResult = await insertConversionRecord(db, {
    id,
    receipt,
    clickId: attribution?.clickId ?? null,
    campaignId: attribution?.campaignId ?? null,
    userId: attribution?.userId ?? null,
    offerId: attribution?.offerId ?? null,
    transactionType,
    grossAmount,
    currency,
    commissionUser,
    commissionSophia,
    payoutStatus: payout_status,
    availableAt: available_at ?? null,
    rawBody,
  });

  if (!insertResult.success) {
    return NextResponse.json({ ok: true, skipped: 'insert_error' }, { status: 200 });
  }

  if (insertResult.isRace) {
    return NextResponse.json({ ok: true, skipped: 'duplicate_race' }, { status: 200 });
  }

  await handlePostInsertNotifications(
    transactionType,
    attributed,
    attribution ? { userId: attribution.userId, campaignId: attribution.campaignId } : null,
    commissionUser,
    db,
    receipt
  );

  logger.info('[clickbank-webhook] conversion recorded', { id, receipt, event_type: transactionType, attributed, payout_status });
  return NextResponse.json({ ok: true }, { status: 200 });
}
