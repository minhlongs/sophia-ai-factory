/**
 * POST /api/creative-identity — create or update workspace identity
 * GET  /api/creative-identity?workspaceId=X — get active identity
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import {
  getActiveIdentity,
  createIdentity,
  updateIdentity,
  newIdentityId,
} from '@/tree/creative-identity';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CreativeIdentity, Tone } from '@/seed/types/creative-domain';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TONES: Tone[] = [
  'formal', 'casual', 'sharp', 'warm',
  'playful', 'authoritative', 'empathetic',
];

const contentFormatSchema = z.object({
  type: z.enum(['video_short', 'video_long', 'image', 'audio', 'article', 'carousel']),
  platform: z.enum(['youtube', 'tiktok', 'x', 'instagram', 'facebook', 'whatsapp', 'blog']),
  maxDurationSeconds: z.number().optional(),
  aspectRatio: z.string().optional(),
  constraints: z.array(z.string()),
});

const createIdentitySchema = z.object({
  workspaceId: z.string().min(1),
  brandId: z.string().optional(),
  voice: z.string().min(1).optional(),
  tone: z.enum(TONES as [string, ...string[]]).optional(),
  formality: z.number().min(0).max(1).optional(),
  energy: z.number().min(0).max(1).optional(),
  beliefs: z.array(z.string()).optional(),
  positioning: z.string().optional(),
  targetAudience: z.string().optional(),
  forbiddenPatterns: z.array(z.string()).optional(),
  requiredDisclosures: z.array(z.string()).optional(),
  formats: z.array(contentFormatSchema).optional(),
  referenceWorks: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyWorkspaceAccess(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  const d1 = createServerClient();
  const membership = await d1
    .prepare('SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?')
    .bind(workspaceId, userId)
    .first();
  return membership !== null;
}

function buildIdentity(
  data: z.infer<typeof createIdentitySchema>,
  userId: string,
  existing?: CreativeIdentity,
): CreativeIdentity {
  const now = Math.floor(Date.now() / 1000);

  return {
    id: existing?.id ?? newIdentityId(),
    workspaceId: data.workspaceId,
    brandId: data.brandId ?? existing?.brandId,
    voiceDescription: data.voice ?? existing?.voiceDescription ?? '',
    tone: (data.tone ?? existing?.tone ?? 'casual') as Tone,
    formality: data.formality ?? existing?.formality ?? 0.5,
    energy: data.energy ?? existing?.energy ?? 0.5,
    beliefs: data.beliefs ?? existing?.beliefs ?? [],
    positioning: data.positioning ?? existing?.positioning ?? '',
    targetAudience: data.targetAudience ?? existing?.targetAudience ?? '',
    forbiddenPatterns: data.forbiddenPatterns ?? existing?.forbiddenPatterns ?? [],
    requiredDisclosures: data.requiredDisclosures ?? existing?.requiredDisclosures ?? [],
    preferredFormats: data.formats ?? existing?.preferredFormats ?? [],
    referenceWorks: data.referenceWorks ?? existing?.referenceWorks ?? [],
    version: existing?.version ?? 0,
    isActive: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedBy: userId,
  };
}

// ---------------------------------------------------------------------------
// POST — create or update identity
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createIdentitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues.map((e) => e.message) },
      { status: 400 },
    );
  }

  const { workspaceId } = parsed.data;

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const existing = await getActiveIdentity(workspaceId);
    const identity = buildIdentity(parsed.data, user.id, existing ?? undefined);

    const result = existing
      ? await updateIdentity(identity)
      : await createIdentity(identity);

    return NextResponse.json(result, { status: existing ? 200 : 201 });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET — active identity for workspace
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required' },
      { status: 400 },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const identity = await getActiveIdentity(workspaceId);
    if (!identity) {
      return NextResponse.json({ identity: null });
    }
    return NextResponse.json({ identity });
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}
