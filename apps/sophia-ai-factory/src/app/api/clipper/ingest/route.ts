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

const ALLOWED_JURISDICTIONS = new Set<ComplianceJurisdiction>(['US', 'UK', 'EU', 'VN', 'SG', 'GLOBAL']);
const ALLOWED_VERTICALS = new Set<ComplianceVertical>(['crypto', 'saas']);

function parseHttpsUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

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
    vertical?: string;
    jurisdiction?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const productName = (body.productName ?? '').trim();
  const safeReferralUrl = parseHttpsUrl(body.referralUrl ?? '');
  if (!productName || !safeReferralUrl) {
    return NextResponse.json(
      { error: 'productName and valid https:// referralUrl are required' },
      { status: 400 },
    );
  }

  const safeOfficialUrl = body.officialUrl ? parseHttpsUrl(body.officialUrl) : safeReferralUrl;
  if (!safeOfficialUrl) {
    return NextResponse.json({ error: 'officialUrl must be a valid https:// URL' }, { status: 400 });
  }

  const jurisdiction: ComplianceJurisdiction = ALLOWED_JURISDICTIONS.has(
    body.jurisdiction as ComplianceJurisdiction,
  )
    ? (body.jurisdiction as ComplianceJurisdiction)
    : 'GLOBAL';
  const vertical: ComplianceVertical = ALLOWED_VERTICALS.has(body.vertical as ComplianceVertical)
    ? (body.vertical as ComplianceVertical)
    : 'saas';

  const preflight = runPolicyPreflight({
    text: `${productName} ${body.notes ?? ''}`.trim(),
    jurisdiction,
    vertical,
  });

  return NextResponse.json({
    ok: true,
    draft: {
      userId: user.id,
      productName,
      officialUrl: safeOfficialUrl,
      referralUrl: safeReferralUrl,
      sanitizedSummary: preflight.sanitizedText,
      requiredDisclosure: preflight.requiredDisclosure,
      warnings: preflight.warnings,
    },
  });
}
