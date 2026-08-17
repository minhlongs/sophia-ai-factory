/**
 * POST /api/publish/approve
 *
 * Marks the current user as having approved WhatsApp outbound sends.
 * This is a one-time action — subsequent calls are idempotent.
 * Auth: session cookie via getCurrentUser()
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';

const approveSchema = z.object({ jobId: z.string().optional() });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const db = getD1();
  if (!db) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    // jobId is optional — approval is per-user, not per-job
    approveSchema.parse(await request.json().catch(() => ({})));

    // Set approval flag for all templates belonging to user
    const result = await db
      .prepare(`UPDATE whatsapp_templates SET whatsapp_approved = 1 WHERE user_id = ?1`)
      .bind(user.id)
      .run();

    if ((result.meta?.changes ?? 0) === 0) {
      return NextResponse.json(
        { error: 'No WhatsApp credentials found — please configure in Setup Wizard first' },
        { status: 400 },
      );
    }

    return NextResponse.json({ approved: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Approval failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}