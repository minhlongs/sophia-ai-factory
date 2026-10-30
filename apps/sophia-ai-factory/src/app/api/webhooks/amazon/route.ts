/**
 * Amazon Associates Webhook Handler (legacy compat delegate).
 *
 * Receives conversion postbacks from Amazon Associates.
 * HMAC-SHA256 verification via X-Amazon-Signature header.
 * Idempotent on the provider order id.
 *
 * Note: Amazon Associates uses standard SNS-style signature verification.
 *
 * Lookup by partner tag used as sub_id. LIMITATION (preserved): Amazon's `tag`
 * is a shared Associates ID across all clicks from the same account; without a
 * composite tag suffix stored as sub_id, ambiguous tags fail closed (401/422)
 * instead of cross-attributing. See docs/postback-tenant-migration.md.
 *
 * @module app/api/webhooks/amazon/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  processLegacyEcommercePostback,
  type LegacyEcommerceContract,
} from '@/land/postback/legacy-ecommerce-handler';

const CONTRACT: LegacyEcommerceContract = {
  slug: 'amazon',
  dbNetwork: 'amazon',
  sigHeaders: ['x-amazon-signature'],
  algorithm: 'SHA-256',
  logTag: 'amazon-webhook',
  txnIdFields: ['order_id'],
  subIdFields: ['tag'],
  clickIdField: null,
  grossField: 'revenue',
  commissionField: 'commission',
  approvedStatus: 'shipped',
  missingTxnSkipCode: 'no_order_id',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const outcome = await processLegacyEcommercePostback(request, CONTRACT);
  return NextResponse.json(outcome.body, { status: outcome.status });
}
