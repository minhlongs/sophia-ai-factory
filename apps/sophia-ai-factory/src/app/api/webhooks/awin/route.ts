/**
 * Awin Webhook Handler (legacy compat delegate).
 *
 * Receives conversion postbacks from Awin Publisher API.
 * HMAC-SHA256 verification via X-Awin-Signature header.
 * Idempotent on the provider transaction id.
 *
 * Provider contract (headers, algorithm, payload fields) is unchanged.
 * Tenant safety is enforced by the shared delegation core: the signing secret
 * comes from the resolved workspace's stored credential, unknown tenants fail
 * closed, and storage failures return 503 instead of a false 200 ack.
 *
 * @module app/api/webhooks/awin/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processLegacyEcommercePostback,
  type LegacyEcommerceContract,
} from '@/land/postback/legacy-ecommerce-handler';

const CONTRACT: LegacyEcommerceContract = {
  slug: 'awin',
  dbNetwork: 'awin',
  sigHeaders: ['x-awin-signature'],
  algorithm: 'SHA-256',
  logTag: 'awin-webhook',
  txnIdFields: ['id'],
  subIdFields: ['click_ref'],
  clickIdField: null,
  grossField: 'sale_amount',
  commissionField: 'commission_amount',
  approvedStatus: 'approved',
  missingTxnSkipCode: 'no_transaction_id',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const outcome = await processLegacyEcommercePostback(request, CONTRACT);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
