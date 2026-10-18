/**
 * Admin Customer Health Monitoring & 1-Click Founder Intervention API
 *
 * Route: /api/admin/customer-intervention
 *
 * GET: Lists customer health scores and high-level anti-churn statistics.
 * POST: Triggers 1-click founder intervention (bonus MCU credits + direct email/telegram outreach).
 *
 * Security: Admin authentication required via requireAdmin().
 *
 * @module app/api/admin/customer-intervention/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import {
  handleCustomerInterventionGet,
  handleCustomerInterventionPost,
} from './customer-intervention-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/customer-intervention
 * Fetches monitored customers and summary statistics.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  return handleCustomerInterventionGet(req);
}

/**
 * POST /api/admin/customer-intervention
 * Executes 1-click founder intervention (bonus credits and/or personal message).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  return handleCustomerInterventionPost(req, auth.user.id);
}
