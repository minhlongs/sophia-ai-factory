import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import type { AuthGate } from './types';

export async function parseAndAuthorize<T extends { workspaceId: string }>(
  request: NextRequest,
  userId: string,
  schema: z.ZodType<T>,
): Promise<AuthGate<T>> {
  const sp = new URL(request.url).searchParams;
  const parsed = schema.safeParse(Object.fromEntries(sp));
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
        { status: 400 },
      ),
    };
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.workspaceId, userId);
  if (!hasAccess) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true, data: parsed.data };
}
