/**
 * Admin Landing Pages [slug] API — get, update, delete single landing page.
 *
 * GET /api/admin/landing-pages/[slug] → getBySlug(slug)
 * PUT /api/admin/landing-pages/[slug] → update(slug, input)
 * DELETE /api/admin/landing-pages/[slug] → remove(slug)
 *
 * Auth: requireAdmin() + requireMasterTier() — both must pass.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/seed/auth/require-admin';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import {
getBySlug,
update,
remove,
} from '@/seed/db/repositories/landing-pages-repo';
import { UpdateLandingPageInputSchema } from '@/seed/types/landing-page-types';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

interface RouteParams {
params: Promise<{ slug: string }>;
}

export async function GET(
request: NextRequest,
{ params }: RouteParams,
): Promise<NextResponse> {
const adminAuth = await requireAdmin(request);
if (adminAuth instanceof Response) return adminAuth;
await requireMasterTier();

try {
const { slug } = await params;
const page = await getBySlug(slug);
if (!page) {
return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
}
return NextResponse.json(page);
} catch (err) {
logger.error('[AdminLandingPagesAPI] GET slug failed', { error: getErrorMessage(err) });
return NextResponse.json({ error: 'Failed to get landing page' }, { status: 500 });
}
}

export async function PUT(
request: NextRequest,
{ params }: RouteParams,
): Promise<NextResponse> {
const adminAuth = await requireAdmin(request);
if (adminAuth instanceof Response) return adminAuth;
await requireMasterTier();

try {
const { slug } = await params;
const body: unknown = await request.json();
const parsed = UpdateLandingPageInputSchema.safeParse(body);

if (!parsed.success) {
return NextResponse.json(
{ error: 'Validation failed', details: parsed.error.flatten() },
{ status: 400 },
);
}

const page = await update(slug, parsed.data);
if (!page) {
return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
}
return NextResponse.json(page);
} catch (err) {
logger.error('[AdminLandingPagesAPI] PUT failed', { error: getErrorMessage(err) });
return NextResponse.json({ error: 'Failed to update landing page' }, { status: 500 });
}
}

export async function DELETE(
request: NextRequest,
{ params }: RouteParams,
): Promise<NextResponse> {
const adminAuth = await requireAdmin(request);
if (adminAuth instanceof Response) return adminAuth;
await requireMasterTier();

try {
const { slug } = await params;
const deleted = await remove(slug);
if (!deleted) {
return NextResponse.json({ error: 'Landing page not found' }, { status: 404 });
}
return NextResponse.json({ success: true });
} catch (err) {
logger.error('[AdminLandingPagesAPI] DELETE failed', { error: getErrorMessage(err) });
return NextResponse.json({ error: 'Failed to delete landing page' }, { status: 500 });
}
}
