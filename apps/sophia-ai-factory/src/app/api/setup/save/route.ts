/**
 * POST /api/setup/save
 *
 * Saves setup wizard API keys encrypted to `user_api_keys` D1 table.
 * CF Workers compatible — no filesystem access.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/better-auth-session';
import { setUserApiKey } from '@/lib/byok/user-api-key-store';
import type { ByokProvider } from '@/lib/byok/user-api-key-store';
import { z } from 'zod';

const setupSaveSchema = z
  .object({
    config: z.object({
      OPENROUTER_API_KEY: z.string().optional(),
      ANTHROPIC_API_KEY: z.string().optional(),
      ELEVENLABS_API_KEY: z.string().optional(),
      DID_API_KEY: z.string().optional(),
      MUAPI_API_KEY: z.string().optional(),
    }),
  })
  .refine(
    (data) =>
      Boolean(data.config.OPENROUTER_API_KEY?.trim()) ||
      Boolean(data.config.ANTHROPIC_API_KEY?.trim()),
    {
      message: 'At least one LLM provider key required (OpenRouter or Anthropic)',
      path: ['config', 'OPENROUTER_API_KEY'],
    },
  );

/** Map Zod config field names → BYOK provider identifiers */
const PROVIDER_MAP: Record<string, ByokProvider> = {
  OPENROUTER_API_KEY: 'openrouter',
  ANTHROPIC_API_KEY: 'anthropic',
  ELEVENLABS_API_KEY: 'elevenlabs',
  DID_API_KEY: 'd-id',
  MUAPI_API_KEY: 'muapi',
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = setupSaveSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message ?? 'Invalid configuration';
      return NextResponse.json(
        { success: false, message: firstError },
        { status: 400 },
      );
    }

    const { config } = parsed.data;
    const saved: string[] = [];

    for (const [field, provider] of Object.entries(PROVIDER_MAP)) {
      const value = config[field as keyof typeof config];
      if (value && value.trim().length > 0) {
        await setUserApiKey(user.id, provider, value.trim());
        saved.push(provider);
      }
    }

    const response = NextResponse.json({
      success: true,
      message: 'API keys saved successfully.',
      saved,
      redirect: '/dashboard/settings',
    });

    // Mark wizard completed so middleware skips the new-user redirect on /dashboard.
    // Cookie name is per-user (`wizard_done_<uid12>`) — middleware reads the same shape.
    const uid12 = user.id.slice(0, 12);
    const cookieFlags = [
      `wizard_done_${uid12}=1`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${60 * 60 * 24 * 365}`,
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');
    response.headers.append('Set-Cookie', cookieFlags);

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    );
  }
}
