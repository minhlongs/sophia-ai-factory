import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getPlatformConfig, setPlatformConfig } from '@/seed/db/platform-config-repo';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const PLATFORM_CONFIG_KEYS = ['honeycomb_api_key', 'honeycomb_dataset'] as const;

const setSchema = z.object({
  key: z.enum(PLATFORM_CONFIG_KEYS),
  value: z.string().min(1).max(500),
});

/**
 * GET /api/admin/platform-config?key=honeycomb_api_key
 * Returns whether a platform config key exists (without revealing the value).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;

  const key = request.nextUrl.searchParams.get('key');
  if (!key || !PLATFORM_CONFIG_KEYS.includes(key as typeof PLATFORM_CONFIG_KEYS[number])) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  const value = await getPlatformConfig(key as typeof PLATFORM_CONFIG_KEYS[number]);
  return NextResponse.json({ exists: !!value });
}

/**
 * POST /api/admin/platform-config
 * Set a platform config value (encrypted at rest).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;

  let body: z.infer<typeof setSchema>;
  try {
    body = setSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body', details: toError(error).message },
      { status: 400 },
    );
  }

  try {
    await setPlatformConfig(body.key, body.value, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save platform config', details: toError(error).message },
      { status: 500 },
    );
  }
}
