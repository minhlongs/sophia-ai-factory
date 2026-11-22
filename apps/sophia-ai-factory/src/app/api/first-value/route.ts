/**
 * /api/first-value — Canonical BASIC First-Value Journey HTTP route (Track B1.1).
 *
 * Exposes:
 * - GET ?orgId=...[&artifactId=...]: read-only status/receipt or `get_review` (zero DB writes)
 * - POST action=cost_preview | fixture_preview | create_review | get_review |
 *   accept_review | reject_review | private_export
 *
 * All mutations require auth, workspace authorization, CSRF verification, and
 * a valid idempotency key. All responses carry `Cache-Control: private, no-store`,
 * `publicPublished: false`, and `paidInferenceExecuted: false`.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { verifyWorkspaceAccess } from '@/seed/auth/workspace-access';
import { getD1 } from '@/seed/db/client';
import { verifyCsrfToken } from '@/seed/security/csrf';
import { listUserApiKeyProviders } from '@/tree/byok/user-api-key-store';
import {
  handleFirstValueGet,
  handleFirstValuePost,
  type FirstValueHttpDeps,
} from '@/land/first-value/first-value-http-handler';

export const dynamic = 'force-dynamic';

function resolveReceiptSigningSecret(): string | null {
  const secret =
    process.env.FIRST_VALUE_RECEIPT_SECRET?.trim() ||
    process.env.BYOK_MASTER_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    '';
  return secret.length >= 16 ? secret : null;
}

function buildLiveDeps(): FirstValueHttpDeps {
  return {
    getD1,
    getCurrentUser,
    verifyWorkspaceAccess,
    verifyCsrf: verifyCsrfToken,
    listByokProviders: listUserApiKeyProviders,
    signingSecret: resolveReceiptSigningSecret(),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return handleFirstValueGet(request, buildLiveDeps());
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handleFirstValuePost(request, buildLiveDeps());
}
