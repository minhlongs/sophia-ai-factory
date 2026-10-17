/**
 * GET & POST /api/open-core/portability
 *
 * Tenant-scoped, D1-backed export and import of non-sensitive workspace
 * configuration (`defaultLocale`, `routingStrategy`, `configuredProviders`
 * metadata, and `channelPresets`) for self-host <-> Sophia Cloud portability.
 *
 * Security invariant: Raw BYOK API keys are NEVER read or exported.
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
} from '@/tree/open-core/workspace-portability';
import {
  loadUserPortableConfig,
  saveUserPortableConfig,
} from '@/tree/open-core/workspace-portability-store';

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

export async function GET(_request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'UNAUTHORIZED', message: 'Authentication required' },
      { status: 401 },
    );
  }

  const persistedState = await loadUserPortableConfig(user.id);
  const bundle = await exportWorkspaceBundle({
    exportedAt: Math.floor(Date.now() / 1000),
    sourceEdition: resolveSophiaEdition({
      sophiaEdition: process.env.SOPHIA_EDITION,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    }),
    defaultLocale: persistedState.defaultLocale,
    routingStrategy: persistedState.routingStrategy,
    configuredProviders: persistedState.configuredProviders,
    channelPresets: persistedState.channelPresets,
  });

  return NextResponse.json({
    success: true,
    userId: user.id,
    bundle,
    settingsUrl: 'https://sophia.agencyos.network/vi/dashboard/settings?tab=openCore',
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

  const { persisted } = await saveUserPortableConfig(user.id, result.value);

  return NextResponse.json({
    success: true,
    userId: user.id,
    persisted,
    importedConfig: result.value,
  });
}
