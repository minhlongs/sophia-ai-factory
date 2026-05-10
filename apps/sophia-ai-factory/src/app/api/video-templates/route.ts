/**
 * Video Templates Library API
 *
 * GET /api/video-templates — List default video templates accessible to the caller's tier.
 * Optional `?category=educational|marketing|social|brand` narrows results.
 *
 * Response shape: only public-facing fields. The internal `transitionsJson` payload
 * is intentionally OMITTED — clients pass `id` to the renderer which resolves the
 * transition spec server-side.
 *
 * Auth: requires session. Tier resolved via `getUserTier(user.id)`.
 *
 * @module app/api/video-templates/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import {
  listTemplatesForTier,
  type TemplatePreset,
  type TemplateCategory,
  type TemplateTier,
} from '@/seed/templates/presets';
import { logger } from '@/seed/utils/logger-utility';

interface PublicTemplatePreset {
  id: string;
  displayName: string;
  category: TemplatePreset['category'];
  aspectRatio: TemplatePreset['aspectRatio'];
  durationSec: number;
  vibe: string;
  samplePath: string;
  minTier: TemplatePreset['minTier'];
}

const VALID_CATEGORIES: ReadonlyArray<TemplateCategory> = [
  'educational', 'marketing', 'social', 'brand',
];

const VALID_TIERS: ReadonlyArray<TemplateTier> = [
  'BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER',
];

function normaliseTier(raw: unknown): TemplateTier {
  if (typeof raw !== 'string') return 'BASIC';
  const upper = raw.toUpperCase() as TemplateTier;
  return VALID_TIERS.includes(upper) ? upper : 'BASIC';
}

function toPublic(preset: TemplatePreset): PublicTemplatePreset {
  return {
    id: preset.id,
    displayName: preset.displayName,
    category: preset.category,
    aspectRatio: preset.aspectRatio,
    durationSec: preset.durationSec,
    vibe: preset.vibe,
    samplePath: preset.samplePath,
    minTier: preset.minTier,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let tier: TemplateTier;
  try {
    tier = normaliseTier(await getUserTier(user.id));
  } catch (err) {
    logger.warn('[video-templates] getUserTier failed', { userId: user.id, error: String(err) });
    return NextResponse.json({ error: 'Failed to resolve tier' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get('category');
  const category: TemplateCategory | undefined =
    categoryParam && VALID_CATEGORIES.includes(categoryParam as TemplateCategory)
      ? (categoryParam as TemplateCategory)
      : undefined;

  const templates = listTemplatesForTier(tier, category).map(toPublic);
  return NextResponse.json({
    tier,
    category: category ?? null,
    count: templates.length,
    templates,
  });
}
