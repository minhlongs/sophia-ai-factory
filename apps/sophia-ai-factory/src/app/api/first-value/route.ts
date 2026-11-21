/**
 * /api/first-value — Canonical BASIC First-Value Journey entry point (Track B1).
 *
 * Exposes:
 * - POST action=cost_preview: authenticated, org-scoped deterministic cost preview
 * - POST action=fixture_preview: authenticated, org-scoped simulated fixture preview
 *   (explicitly labeled SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE; zero external spend)
 *
 * All responses carry `Cache-Control: private, no-store` and `publicPublished: false`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { buildFirstValueCostPreview } from '@/seed/ai/cost/first-value-cost-preview';
import { selectModelForTier } from '@/seed/ai/script-generator';
import {
  buildDeterministicFixtureScript,
  getProvenanceLabel,
} from '@/tree/first-value/first-value-contract';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
} as const;

const FirstValueRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('cost_preview'),
    orgId: z.string().min(1).max(128),
    provider: z.string().min(1).max(64).nullable().optional(),
    model: z.string().min(1).max(128).nullable().optional(),
    topic: z.string().min(1).max(500).trim(),
    audience: z.string().min(1).max(300).trim(),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
  }),
  z.object({
    action: z.literal('fixture_preview'),
    orgId: z.string().min(1).max(128),
    topic: z.string().min(1).max(500).trim(),
    audience: z.string().min(1).max(300).trim(),
    durationSec: z.number().int().min(10).max(300).optional().default(30),
  }),
]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized / Bạn cần đăng nhập' },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body / Dữ liệu JSON không hợp lệ' },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const parsed = FirstValueRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed / Dữ liệu không hợp lệ',
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }

  const hasAccess = await verifyWorkspaceAccess(parsed.data.orgId, user.id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'Organization access denied / Không có quyền truy cập tổ chức này' },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }

  if (parsed.data.action === 'cost_preview') {
    const provider = parsed.data.provider === undefined ? 'openrouter' : parsed.data.provider;
    const model =
      parsed.data.model === undefined ? selectModelForTier('BASIC') : parsed.data.model;
    const preview = buildFirstValueCostPreview({
      provider,
      model,
      topic: parsed.data.topic,
      audience: parsed.data.audience,
      durationSec: parsed.data.durationSec,
      capabilitiesKnown: 'inferred_from_provider_table',
    });

    return NextResponse.json(
      {
        orgId: parsed.data.orgId,
        preview,
        publicPublished: false as const,
        paidInferenceExecuted: false as const,
      },
      { status: 200, headers: PRIVATE_HEADERS },
    );
  }

  const script = buildDeterministicFixtureScript(
    parsed.data.topic,
    parsed.data.audience,
    parsed.data.durationSec,
  );

  return NextResponse.json(
    {
      orgId: parsed.data.orgId,
      provenance: 'fixture_simulated' as const,
      provenanceLabel: getProvenanceLabel('fixture_simulated'),
      reviewState: 'pending_review' as const,
      publicPublished: false as const,
      paidInferenceExecuted: false as const,
      script,
    },
    { status: 200, headers: PRIVATE_HEADERS },
  );
}
