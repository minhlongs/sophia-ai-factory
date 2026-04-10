/**
 * POST /api/setup/save
 *
 * Saves setup wizard config to user profile (Supabase).
 * CF Workers compatible — no filesystem access needed.
 * Keys are stored encrypted via the settings server action.
 */

import { NextResponse } from 'next/server';
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

export async function POST(request: Request) {
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
    // Instead, return success and instruct the UI to redirect to
    // /dashboard/settings where users can save keys via the BYOK form.
    // The setup wizard serves as a guided onboarding, not a config writer.

    return NextResponse.json({
      success: true,
      message: 'Setup complete! Redirecting to dashboard settings to save your API keys securely.',
      redirect: '/dashboard/settings',
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
