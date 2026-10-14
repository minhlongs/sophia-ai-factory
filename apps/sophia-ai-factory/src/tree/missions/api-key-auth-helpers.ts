/**
 * API Key Authentication Types & HTTP Error Helpers for /api/v1/missions
 *
 * @module tree/missions/api-key-auth-helpers
 */

import { NextResponse } from "next/server";

export type ApiKeyAuthErrorType =
  | "missing_credentials"
  | "invalid_key"
  | "inactive"
  | "db_unreachable";

export interface ApiKeyAuthResult {
  valid: boolean;
  userId?: string;
  error?: string;
  /** Discriminates error category for HTTP status mapping at callers. */
  errorType?: ApiKeyAuthErrorType;
}

export interface ApiKeyRow {
  user_id: string;
  is_active: boolean;
  expires_at: string | null;
}

export function extractRawApiKey(
  authHeader: string | null,
  xApiKey: string | null,
): string | null {
  if (authHeader?.startsWith("Bearer ")) {
    const trimmed = authHeader.substring(7).trim();
    return trimmed === "" ? null : trimmed;
  }
  if (xApiKey) {
    return xApiKey.trim();
  }
  return null;
}

/**
 * DRY helper: converts a failed ApiKeyAuthResult to a NextResponse with correct HTTP status.
 *
 *   invalid_key / missing_credentials → 401
 *   inactive                          → 403
 *   db_unreachable                    → 503
 */
export function apiKeyAuthErrorResponse(auth: ApiKeyAuthResult): NextResponse {
  const status =
    auth.errorType === "db_unreachable"
      ? 503
      : auth.errorType === "inactive"
        ? 403
        : 401;
  return NextResponse.json({ error: auth.error ?? "Auth failed" }, { status });
}
