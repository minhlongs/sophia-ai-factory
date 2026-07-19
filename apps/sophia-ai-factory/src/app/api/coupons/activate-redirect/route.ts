/**
 * GET /api/coupons/activate-redirect?coupon=FREE50&tier=MASTER
 *
 * Browser-friendly coupon entry link.
 * GET intentionally does not mutate state; authenticated activation happens via
 * POST /api/coupons/activate after login with CSRF protection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActivateCoupons } from '@/seed/config/coupons';

export async function GET(request: NextRequest) {
  const coupon = (request.nextUrl.searchParams.get('coupon') || '').toUpperCase();
  const tier = (request.nextUrl.searchParams.get('tier') || 'MASTER').toUpperCase();

  if (!getActivateCoupons()[coupon]) {
    return NextResponse.redirect(new URL('/dashboard?error=invalid_coupon', request.url));
  }

  const loginUrl = new URL('/vi/login', request.url);
  loginUrl.searchParams.set('coupon', coupon);
  loginUrl.searchParams.set('tier', tier);
  loginUrl.searchParams.set('free', '1');
  return NextResponse.redirect(loginUrl);
}
