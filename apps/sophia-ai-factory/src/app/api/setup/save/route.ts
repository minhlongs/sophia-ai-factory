/**
 * POST /api/setup/save
 *
 * Saves setup wizard API keys encrypted to `user_api_keys` D1 table.
 * CF Workers compatible — no filesystem access.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { setUserApiKey } from '@/tree/byok/user-api-key-store';
import type { ByokProvider } from '@/tree/byok/user-api-key-store';
import { z } from 'zod';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { validateProviderKey, sanitizeCredential } from '@/tree/byok/key-format-validators';
import type { ValidatorProvider } from '@/tree/byok/key-format-validators';

const setupSaveSchema = z
  .object({
    config: z.object({
      OPENROUTER_API_KEY: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
      ANTHROPIC_API_KEY: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
      ELEVENLABS_API_KEY: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
      DID_API_KEY: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
      MUAPI_API_KEY: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
      APOLLO_API_KEY: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
      HUNTER_API_KEY: z.preprocess((val) => typeof val === 'string' ? sanitizeCredential(val) : val, z.string().optional()),
    }),
  })
  .refine(
    (data) =>
      Boolean(data.config.OPENROUTER_API_KEY) ||
      Boolean(data.config.ANTHROPIC_API_KEY),
    {
      message: 'At least one LLM provider key required (OpenRouter or Anthropic)',
      path: ['config', 'OPENROUTER_API_KEY'],
    },
  )
  .superRefine((data, ctx) => {
    for (const [field, provider] of Object.entries(PROVIDER_MAP)) {
      const val = data.config[field as keyof typeof data.config];
      if (val && val.length > 0) {
        const validation = validateProviderKey(provider as ValidatorProvider, val);
        if (!validation.ok) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['config', field],
            message: `Invalid format for ${provider}`,
          });
        }
      }
    }
  });

/** Map Zod config field names → BYOK provider identifiers */
const PROVIDER_MAP: Record<string, ByokProvider> = {
  OPENROUTER_API_KEY: 'openrouter',
  ANTHROPIC_API_KEY: 'anthropic',
  ELEVENLABS_API_KEY: 'elevenlabs',
  DID_API_KEY: 'd-id',
  MUAPI_API_KEY: 'muapi',
  APOLLO_API_KEY: 'apollo',
  HUNTER_API_KEY: 'hunter',
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
      if (value && value.length > 0) {
        const validation = validateProviderKey(provider as ValidatorProvider, value);
        const finalValue = validation.ok && validation.autoEncoded ? validation.autoEncoded : value;
        await setUserApiKey(user.id, provider, finalValue);
        saved.push(provider);
      }
    }

    // Mark onboarding complete in DB (primary) and cookie (fallback resilience)
    try {
      const db = getD1()
      if (!db) throw new Error('D1 database binding not available')
      const nowMs = Date.now()
      db
        .prepare(
          'UPDATE user_profiles SET onboarding_completed_at = ? WHERE user_id = ?',
        )
        .bind(nowMs, user.id)
        .run()
      // H1: Auto-enable pre-installed SOPs after CEO completes BYOK wizard
      db
        .prepare(
          'UPDATE user_sop_installations SET enabled = 1 WHERE user_id = ? AND enabled = 0',
        )
        .bind(user.id)
        .run()
    } catch (dbErr) {
      // Non-fatal — cookie fallback below ensures wizard gate is satisfied
      logger.warn('[SetupSave] Failed to set onboarding_completed_at in DB', { error: dbErr })
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
