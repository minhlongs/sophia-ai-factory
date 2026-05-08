import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

/**
 * Proposals API — STUB.
 *
 * Real implementation pending: D1 schema for `proposals` table + LLM generation
 * pipeline. Until then, this endpoint exists so the form does not silently 404
 * and clients receive a clear, structured error message they can display.
 *
 * Replace with full implementation once `migrations/NNNN-proposals.sql` lands.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        'Proposal generation is not available yet. The feature is in development — your input was not saved.',
      code: 'PROPOSALS_NOT_IMPLEMENTED',
    },
    { status: 501 },
  );
}
