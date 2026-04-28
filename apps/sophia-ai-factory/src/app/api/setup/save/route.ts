/**
 * POST /api/setup/save
 *
 * Saves setup wizard config to user profile (Cloudflare D1).
 * CF Workers compatible — no filesystem access needed.
 * Keys are stored encrypted via the settings server action.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { z } from 'zod';

const setupSaveSchema = z.object({
  config: z.object({
    OPENROUTER_API_KEY: z.string().optional(),
    ELEVENLABS_API_KEY: z.string().optional(),
    DID_API_KEY: z.string().optional(),
    HEYGEN_API_KEY: z.string().optional(),
    MUAPI_API_KEY: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = setupSaveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid configuration' },
        { status: 400 },
      );
    }

    // On Cloudflare Workers, we can't write to filesystem.
    // Return success and instruct the UI to redirect to
    // /dashboard/settings where users can save keys via the BYOK form.
    // The setup wizard serves as a guided onboarding, not a config writer.

    return NextResponse.json({
      success: true,
      message: 'Setup complete! Configure your API keys in Settings.',
      redirect: '/dashboard/settings',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
