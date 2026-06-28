/**
 * GET|POST|PUT|DELETE|PATCH /api/admin/promo-codes
 * Bare path guard — sub-paths like /[id]/status and /bulk-generate handle real operations.
 * Returns 404 for GET and 405 for all other methods to prevent scanner fingerprinting via HTML fall-through.
 * @module app/api/admin/promo-codes
 */

import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

function methodNotAllowed() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
