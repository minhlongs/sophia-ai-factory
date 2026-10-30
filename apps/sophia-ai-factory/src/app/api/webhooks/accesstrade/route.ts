/**
 * AccessTrade Webhook Handler (legacy compat delegate).
 *
 * Receives conversion postbacks from AccessTrade VN.
 * HMAC-SHA256 verification via X-Accesstrade-Signature header.
 * Idempotent on the provider transaction id.
 *
 * Provider contract (headers, algorithm, payload fields) is unchanged.
 * Tenant safety is enforced by the shared delegation core: the signing secret
 * comes from the resolved workspace's stored credential, unknown tenants fail
 * closed, and storage failures return 503 instead of a false 200 ack.
 *
 * @module app/api/webhooks/accesstrade/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processLegacyEcommercePostback,
  type LegacyEcommerceContract,
} from '@/land/postback/legacy-ecommerce-handler';

const CONTRACT: LegacyEcommerceContract = {
  slug: 'accesstrade',
  dbNetwork: 'accesstrade',
  sigHeaders: ['x-accesstrade-signature'],
  algorithm: 'SHA-256',
  logTag: 'accesstrade-webhook',
  txnIdFields: ['conversion_id'],
  subIdFields: ['sub_id'],
  clickIdField: 'click_id',
  grossField: 'order_value',
  commissionField: 'commission',
  approvedStatus: 'approved',
  missingTxnSkipCode: 'no_conversion_id',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const outcome = await processLegacyEcommercePostback(request, CONTRACT);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
