/**
 * GET & POST /api/open-core/portability
 *
 * Enables 60-second workspace migration from a self-hosted Apache-2.0 Community
 * instance into a paid `https://sophia.agencyos.network` Managed Cloud workspace.
 *
 * - GET: Exports a signed `SignedWorkspaceBundle` for the authenticated user.
 * - POST: Validates and imports a `SignedWorkspaceBundle` (HMAC-SHA256 verified).
 *
 * Security invariant: Raw BYOK API keys are NEVER exported.
 *
 * @module app/api/open-core/portability/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveSophiaEdition } from '@/seed/config/edition-config';
import {
  exportWorkspaceBundle,
  importWorkspaceBundle,
  type AllowedPortableProvider,
} from '@/tree/open-core/workspace-portability';

export const dynamic = 'force-dynamic';

const channelPresetSchema = z.object({
  slug: z.string().min(1).max(80),
  niche: z.string().min(1).max(120),
  locale: z.enum(['vi', 'en']),
  cadencePerWeek: z.number().int().min(0).max(100),
});

const importBundleBodySchema = z.object({
  config: z.object({
    schemaVersion: z.literal('sophia-workspace-v1'),
    exportedAt: z.number(),
    sourceEdition: z.enum(['community', 'cloud', 'enterprise']),
    defaultLocale: z.enum(['vi', 'en']),
    routingStrategy: z.enum(['priority', 'costOptimized', 'leastUsed']),
    configuredProviders: z.array(
      z.enum(['openrouter', 'elevenlabs', 'heygen', 'did', 'resend', 'nowpayments']),
    ),
    channelPresets: z.array(channelPresetSchema),
  }),
  checksumHex: z.string().min(64).max(64),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 },
    );
  }

  const localeParam = request.nextUrl.searchParams.get('locale');
  const defaultLocale: 'vi' | 'en' = localeParam === 'en' ? 'en' : 'vi';
  const routingParam = request.nextUrl.searchParams.get('routingStrategy');
  const routingStrategy: 'priority' | 'costOptimized' | 'leastUsed' =
    routingParam === 'costOptimized' || routingParam === 'leastUsed'
      ? routingParam
      : 'priority';

  const providersParam = request.nextUrl.searchParams.get('providers');
  const allowedSet = new Set<AllowedPortableProvider>([
    'openrouter', 'elevenlabs', 'heygen', 'did', 'resend', 'nowpayments',
  ]);
  const configuredProviders: AllowedPortableProvider[] = providersParam
    ? (providersParam
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is AllowedPortableProvider => allowedSet.has(s as AllowedPortableProvider)))
    : ['openrouter', 'elevenlabs', 'heygen'];

  const bundle = await exportWorkspaceBundle({
    exportedAt: Math.floor(Date.now() / 1000),
    sourceEdition: resolveSophiaEdition({ appUrl: request.nextUrl.origin }),
    defaultLocale,
    routingStrategy,
    configuredProviders,
    channelPresets: [],
  });

  return NextResponse.json({
    success: true,
    userId: user.id,
    bundle,
    cloudImportUrl: 'https://sophia.agencyos.network/vi/setup-wizard?import=workspace-v1',
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'INVALID_JSON', message: 'Invalid JSON request body' },
      { status: 400 },
    );
  }

  const parsed = importBundleBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Invalid workspace bundle format',
      },
      { status: 400 },
    );
  }

  const result = await importWorkspaceBundle(parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: result.error.code,
        message: result.error.message,
      },
      { status: 422 },
    );
  }

  return NextResponse.json({
    success: true,
    userId: user.id,
    importedConfig: result.value,
  });
}
