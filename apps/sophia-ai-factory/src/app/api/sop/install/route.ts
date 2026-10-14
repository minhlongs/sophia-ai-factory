/**
 * POST /api/sop/install — install a SOP template for the authenticated user.
 *
 * API parity with installSopAction Server Action for SDK/external callers.
 * Body: { slug, scheduleCron?, enabled? }
 * Returns: { installationId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getTemplateBySlug, createInstallation, setEnabled } from '@/seed/sop/sop-repo';
import { generateWebhookSecret } from '@/seed/sop/webhook-hmac';
import { installInputSchema } from '@/seed/sop/install-input-schema';
import { getSopD1 } from '@/seed/sop/d1';
import type { SopCustomizations } from '@/seed/sop/sop-types';

export const dynamic = 'force-dynamic';

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
  const db = getSopD1();
  if (!db) return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });

  const template = await getTemplateBySlug(db, slug);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const webhookSecret = generateWebhookSecret();
  const customizations: SopCustomizations = { webhookSecret };

  let installation;
  try {
    installation = await createInstallation(db, {
      userId: user.id,
      templateId: template.id,
      scheduleCron: scheduleCron ?? undefined,
      customizations,
    });
  } catch (err) {
    if ((err as unknown as { code?: string })?.code === 'PAYMENT_REQUIRED') {
      return NextResponse.json(
        { error: 'Payment required', message: err instanceof Error ? err.message : 'Payment required' },
        { status: 402 },
      );
    }
    throw err;
  }

  if (!enabled) {
    await setEnabled(db, installation.id, false);
  }

  return NextResponse.json({ installationId: installation.id }, { status: 201 });
}
