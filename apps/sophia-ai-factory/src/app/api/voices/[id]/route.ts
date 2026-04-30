/**
 * Voice Library — Single Voice Operations
 *
 * DELETE /api/voices/[id] — Delete a voice (tenant-scoped).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

interface VoiceRow {
  id: string;
  tenant_id: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** DELETE /api/voices/[id] */
export async function DELETE(_request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const tenantId = (user as unknown as { tenantId?: string }).tenantId ?? user.id;
  const db = createServerClient();

  // Verify voice belongs to this tenant
  const { data, error: fetchError } = await db
    .from('voices')
    .select('id, tenant_id')
    .eq('id', id)
    .single();

  if (fetchError || !data) {
    return NextResponse.json({ error: 'Voice not found' }, { status: 404 });
  }

  const voiceRow = data as unknown as VoiceRow;
  if (voiceRow.tenant_id !== tenantId) {
    logger.warn('[Voices] Cross-tenant delete attempt', { voiceId: id, requestTenant: tenantId });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error: deleteError } = await db.from('voices').delete().eq('id', id);

  if (deleteError) {
    logger.warn('[Voices] Delete failed', { voiceId: id, error: String(deleteError) });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
