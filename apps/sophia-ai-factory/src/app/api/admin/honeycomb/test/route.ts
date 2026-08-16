/**
 * POST /api/admin/honeycomb/test
 *
 * Tests a Honeycomb API key by calling the Honeycomb auth check endpoint.
 * If no apiKey is provided in the body, reads the stored key from platform config.
 *
 * Auth: requireAdminWithRecentAuth
 * Returns: { ok: boolean } or { error: string }
 *
 * @module app/api/admin/honeycomb/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getPlatformConfig } from '@/seed/db/platform-config-repo';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const HONEYCOMB_AUTH_URL = 'https://api.honeycomb.io/v1/auth/check';

const testSchema = z.object({
  apiKey: z.string().optional(),
});

/**
 * Test a Honeycomb API key by making a request to the Honeycomb auth endpoint.
 * Proxy pattern: the key never leaves the server unencrypted (sent only to Honeycomb).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;

  let apiKey: string | null = null;

  try {
    const body = testSchema.parse(await request.json());
    apiKey = body.apiKey ?? null;
  } catch {
    // No body or invalid body — will try stored key below
  }

  // If no key provided in request, try stored key
  if (!apiKey) {
    try {
      apiKey = await getPlatformConfig('honeycomb_api_key');
    } catch {
      // Fall through to error below
    }
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'No API key provided and no stored key found. Save a key first.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(HONEYCOMB_AUTH_URL, {
      method: 'GET',
      headers: {
        'X-Honeycomb-Team': apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      return NextResponse.json({ ok: true });
    }

    if (response.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key. Check the key and try again.' },
        { status: 200 }, // Return 200 with error message so the client can display it
      );
    }

    return NextResponse.json(
      { error: `Honeycomb API returned status ${response.status}` },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Connection failed: ${toError(err).message}` },
      { status: 200 }, // Return 200 so client always gets JSON
    );
  }
}
