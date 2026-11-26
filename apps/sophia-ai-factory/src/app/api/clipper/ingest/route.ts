/**
 * POST /api/clipper/ingest — Chrome/Edge MV3 Quick-Clipper Intake Endpoint.
 *
 * Receives 1-click captured offer metadata (productName, officialUrl, referralUrl,
 * vertical, jurisdiction) from an authenticated user and runs 4-matrix Policy
 * Preflight before returning a ready-to-save Studio draft.
 *
 * @module app/api/clipper/ingest/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import {
  runPolicyPreflight,
  type ComplianceJurisdiction,
  type ComplianceVertical,
} from '@/seed/compliance/policy-preflight-engine';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: {
    productName?: string;
    officialUrl?: string;
    referralUrl?: string;
    notes?: string;
    vertical?: ComplianceVertical;
    jurisdiction?: ComplianceJurisdiction;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const productName = (body.productName ?? '').trim();
  const referralUrl = (body.referralUrl ?? '').trim();
  if (!productName || !referralUrl.startsWith('https://')) {
    return NextResponse.json(
      { error: 'productName and https:// referralUrl are required' },
      { status: 400 },
    );
  }

  const preflight = runPolicyPreflight({
    text: `${productName} ${body.notes ?? ''}`.trim(),
    jurisdiction: body.jurisdiction ?? 'GLOBAL',
    vertical: body.vertical ?? 'saas',
  });

  return NextResponse.json({
    ok: true,
    draft: {
      userId: user.id,
      productName,
      officialUrl: body.officialUrl ?? referralUrl,
      referralUrl,
      sanitizedSummary: preflight.sanitizedText,
      requiredDisclosure: preflight.requiredDisclosure,
      warnings: preflight.warnings,
    },
  });
}
