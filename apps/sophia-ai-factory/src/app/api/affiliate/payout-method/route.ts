/**
 * POST/GET/DELETE /api/affiliate/payout-method
 *
 * Manage USDT payout methods for authenticated affiliate.
 * POST: validate checksum, encrypt address, insert (verified=0).
 * GET: list methods (address masked — no plaintext exposed).
 * DELETE ?id=: remove method.
 *
 * @module app/api/affiliate/payout-method
 */

import { NextRequest } from 'next/server';
import {
  handleCreatePayoutMethod,
  handleListPayoutMethods,
  handleDeletePayoutMethod,
} from './payout-method-route-handler';

export async function POST(request: NextRequest) {
  return handleCreatePayoutMethod(request);
}

export async function GET(_request: NextRequest) {
  return handleListPayoutMethods();
}

export async function DELETE(request: NextRequest) {
  return handleDeletePayoutMethod(request);
}