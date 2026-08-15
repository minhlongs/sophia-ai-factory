/**
 * GET / PUT /api/branding
 *
 * Org-scoped branding (agency name, logo URL, watermark policy).
 * Read: every authenticated org member.
 * Write: org owner / admin role.
 *
 * @module app/api/branding/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';
import { getUserOrganization } from '@/seed/db/auth';
import { getD1 } from '@/seed/db/client';
import { errorResponse, handleThrownError } from '@/seed/api';
import { getOrgBranding, upsertOrgBranding } from '@/tree/branding/org-branding-repo';
import { logger } from '@/seed/utils/logger-utility';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await getUserOrganization(user.id);
  if (!org) return NextResponse.json({ branding: null });

  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');
    const branding = await getOrgBranding(db, org.id);
    return NextResponse.json({ branding, orgId: org.id });
  } catch (err) {
    return handleThrownError(err, 'Failed to load branding', 'BRANDING_LOAD_FAILED');
  }
}

const putSchema = z.object({
  agencyName: z.string().max(200).nullable().optional(),
  logoUrl: z.string().url().max(500).nullable().optional(),
  watermarkPosition: z
    .enum(['bottom-right', 'bottom-left', 'top-right', 'top-left'])
    .optional(),
  watermarkOpacity: z.number().min(0).max(1).optional(),
  watermarkPolicy: z.enum(['always', 'master_plus', 'never']).optional(),
  primaryColor: z.string().max(20).nullable().optional(),
});

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const org = await getUserOrganization(user.id);
  if (!org) return NextResponse.json({ error: 'No organization' }, { status: 404 });

  if (org.role !== 'owner' && org.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — owner/admin only' }, { status: 403 });
  }

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await request.json());
  } catch {
    return errorResponse('Invalid input', 'VALIDATION_ERROR', 400);
  }

  try {
    const db = getD1();
    if (!db) throw new Error('D1 database binding not available');
    const branding = await upsertOrgBranding(db, org.id, body);
    logger.info('[Branding/PUT] updated', { orgId: org.id, by: user.id });
    return NextResponse.json({ branding });
  } catch (err) {
    return handleThrownError(err, 'Failed to save branding', 'BRANDING_SAVE_FAILED');
  }
}
