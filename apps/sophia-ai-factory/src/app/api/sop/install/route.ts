/**
 * POST /api/sop/install — install a SOP template for the authenticated user.
 *
 * API parity with installSopAction Server Action for SDK/external callers.
 * Body: { slug, scheduleCron?, enabled? }
 * Returns: { installationId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { getTemplateBySlug, createInstallation, setEnabled } from '@/lib/sop/sop-repo';
import { generateWebhookSecret } from '@/lib/sop/webhook-hmac';
import { installInputSchema } from '@/lib/sop/install-input-schema';
import type { SopCustomizations } from '@/lib/sop/sop-types';

export const dynamic = 'force-dynamic';

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = installInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.issues }, { status: 400 });
  }

  const { slug, scheduleCron, enabled } = parsed.data;
  const db = getD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const template = await getTemplateBySlug(db, slug);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const webhookSecret = generateWebhookSecret();
  const customizations: SopCustomizations = { webhookSecret };

  const installation = await createInstallation(db, {
    userId: user.id,
    templateId: template.id,
    scheduleCron: scheduleCron ?? undefined,
    customizations,
  });

  if (!enabled) {
    await setEnabled(db, installation.id, false);
  }

  return NextResponse.json({ installationId: installation.id }, { status: 201 });
}
