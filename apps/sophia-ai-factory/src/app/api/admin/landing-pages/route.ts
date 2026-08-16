/**
 * Admin Landing Pages API — list all + create new.
 *
 * GET /api/admin/landing-pages → listAll()
 * POST /api/admin/landing-pages → create(input)
 *
 * Auth: requireAdmin() + requireMasterTier() — both must pass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
listAll,
create,
} from '@/seed/db/repositories/landing-pages-repo';
import { CreateLandingPageInputSchema } from '@/seed/types/landing-page-types';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

export async function GET(
request: NextRequest,
): Promise<NextResponse> {
const adminAuth = await requireAdmin(request);
if (adminAuth instanceof Response) return adminAuth;
await requireMasterTier();

try {
const pages = await listAll();
return NextResponse.json(pages);
} catch (err) {
logger.error('[AdminLandingPagesAPI] GET failed', { error: getErrorMessage(err) });
return NextResponse.json({ error: 'Failed to list landing pages' }, { status: 500 });
}
}

export async function POST(
request: NextRequest,
): Promise<NextResponse> {
const adminAuth = await requireAdmin(request);
if (adminAuth instanceof Response) return adminAuth;
await requireMasterTier();

try {
const body: unknown = await request.json();
const parsed = CreateLandingPageInputSchema.safeParse(body);

if (!parsed.success) {
return NextResponse.json(
{ error: 'Validation failed', details: parsed.error.flatten() },
{ status: 400 },
);
}

const page = await create(parsed.data);
return NextResponse.json(page, { status: 201 });
} catch (err) {
logger.error('[AdminLandingPagesAPI] POST failed', { error: getErrorMessage(err) });
return NextResponse.json({ error: 'Failed to create landing page' }, { status: 500 });
}
}
