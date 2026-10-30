/**
 * TikTok Shop Webhook Handler (legacy compat delegate).
 *
 * Receives order/conversion postbacks from TikTok Partner API.
 * HMAC-SHA256 verification via X-Tts-Signature header.
 * Idempotent on the provider order id (UNIQUE constraint in conversion_events).
 *
 * Unparseable bodies and missing order ids keep the legacy 200 + skipped ack
 * (permanent garbage must not cause retry storms). All other failures fail
 * loud: unknown tenants 422, storage/config failures 503.
 *
 * @module app/api/webhooks/tiktok-shop/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processLegacyEcommercePostback,
  type LegacyEcommerceContract,
} from '@/land/postback/legacy-ecommerce-handler';

const CONTRACT: LegacyEcommerceContract = {
  slug: 'tiktok_shop',
  dbNetwork: 'tiktok_shop',
  sigHeaders: ['x-tts-signature'],
  algorithm: 'SHA-256',
  logTag: 'tiktok-shop-webhook',
  txnIdFields: ['order_id'],
  subIdFields: ['sub_id'],
  clickIdField: null,
  grossField: 'settlement_amount',
  commissionField: 'commission_amount',
  approvedStatus: null,
  missingTxnSkipCode: 'no_order_id',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const outcome = await processLegacyEcommercePostback(request, CONTRACT);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
