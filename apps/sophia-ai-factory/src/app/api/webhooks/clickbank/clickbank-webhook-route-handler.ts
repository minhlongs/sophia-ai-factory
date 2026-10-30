/**
 * ClickBank INS Webhook — core route handler logic.
 *
 * Provider contract is unchanged: HMAC-SHA1 over the raw body via the
 * X-Clickbank-Signature header, INS payload parsing, click attribution,
 * 70/30 commission split economics, and affiliate_conversions persistence.
 *
 * Tenant safety (changed): the signing secret comes from the attributed
 * workspace's stored ClickBank credential — never from a global env secret.
 * Unattributed callbacks, missing credentials, and storage failures fail loud
 * (422/503) instead of recording orphan rows or returning false 200 acks.
 * Parse errors and duplicates keep the legacy 200 + skipped ack so ClickBank
 * does not retry-storm bodies that can never succeed.
 *
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
import { getCredentials } from '@/land/affiliates/credentials';
import { pickCredentialSecret } from '@/land/postback/network-secret-resolver';
import { LEGACY_MIGRATION_GUIDANCE } from '@/land/postback/legacy-tenant-resolver';
import {
  resolvePayout,
  getD1Binding,
} from './clickbank-webhook-helpers';
import { checkDuplicateConversion, insertConversionRecord } from './clickbank-webhook-db';
import { handlePostInsertNotifications } from './clickbank-webhook-notify';

export async function handleClickBankWebhook(request: Request): Promise<NextResponse> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const rl = await checkRateLimit(`clickbank:${ip}`, 1000, 60);
  if (!rl.allowed) {
    logger.warn('[clickbank-webhook] rate limited', { ip });
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-clickbank-signature') ?? '';

  const postback = parsePostback(rawBody);
  if (!postback) {
    logger.warn('[clickbank-webhook] unparseable postback body');
    return NextResponse.json({ ok: true, skipped: 'parse_error' }, { status: 200 });
  }

  const { receipt, transactionType, amount, currency, cvendthru } = postback;
  const db = getD1Binding();

  if (!db) {
    logger.error('[clickbank-webhook] D1 binding unavailable');
    return NextResponse.json({ ok: false, error: 'db_unavailable' }, { status: 503 });
  }

  // Attribution first (untrusted hint): the workspace that owns the click
  // selects WHICH stored credential authenticates this callback.
  const attribution = cvendthru ? await attributeClick(cvendthru) : null;
  if (!attribution) {
    logger.warn('[clickbank-webhook] unattributed callback rejected', { receipt });
    return NextResponse.json(
      {
        ok: false,
        error: 'link_unattributed',
        guidance: LEGACY_MIGRATION_GUIDANCE,
      },
      { status: 422 },
    );
  }
  const tenantId = attribution.userId;

  const creds = await getCredentials(db, tenantId, 'clickbank');
  const secret = creds ? pickCredentialSecret('clickbank', creds) : null;
  if (!secret) {
    logger.warn('[clickbank-webhook] workspace credential not configured', { tenantId });
    return NextResponse.json(
      {
        ok: false,
        error: 'secret_not_configured',
        tenantId,
        guidance: LEGACY_MIGRATION_GUIDANCE,
      },
      { status: 503 },
    );
  }

  const isValid = await verifyClickBankSignature(rawBody, signature, secret);
  if (!isValid) {
    logger.warn('[clickbank-webhook] invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (await checkDuplicateConversion(db, receipt, transactionType)) {
    logger.info('[clickbank-webhook] duplicate receipt skipped', { receipt });
    return NextResponse.json({ ok: true, skipped: 'duplicate' }, { status: 200 });
  }

  const isReversal = transactionType === 'REFUND' || transactionType === 'CHARGEBACK';
  const grossAmount = isReversal ? -Math.abs(amount) : amount;

  const { user: commissionUser, sophia: commissionSophia } = calcCommission(grossAmount);
  const { payout_status, available_at } = resolvePayout(transactionType, true);

  const id = crypto.randomUUID();

  const insertResult = await insertConversionRecord(db, {
    id,
    receipt,
    clickId: attribution.clickId,
    campaignId: attribution.campaignId,
    userId: attribution.userId,
    offerId: attribution.offerId,
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
    return NextResponse.json({ ok: false, error: 'db_write_failed' }, { status: 503 });
  }

  if (insertResult.isRace) {
    return NextResponse.json({ ok: true, skipped: 'duplicate_race' }, { status: 200 });
  }

  await handlePostInsertNotifications(
    transactionType,
    true,
    { userId: attribution.userId, campaignId: attribution.campaignId },
    commissionUser,
    db,
    receipt
  );

  logger.info('[clickbank-webhook] conversion recorded', { id, receipt, event_type: transactionType, attributed: true, payout_status });
  return NextResponse.json({ ok: true }, { status: 200 });
}
