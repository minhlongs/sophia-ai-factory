/**
 * API Key Authentication for /api/v1/missions
 *
 * Primary path: validates Authorization: Bearer <key> or x-api-key header
 * against raas_api_keys table (SHA-256 hash comparison). Used by external API clients.
 *
 * Fallback path: session cookie auth via getCurrentUser(). Used by browser
 * clients (e.g. RenderProgress EventSource) that cannot send custom headers.
 * Ownership check is enforced separately by the route (mission.user_id === userId).
 *
 * Error taxonomy (M6):
 *   invalid_key       → caller returns 401 (key not found in DB)
 *   inactive          → caller returns 403 (key found but is_active=false)
 *   db_unreachable    → caller returns 503 (DB threw exception)
 *   missing_credentials → caller returns 401 (no key + no session)
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/seed/db/client";
import { sha256 } from "@/tree/audit/crypto-utils";
import { logger } from "@/seed/utils/logger-utility";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { forwardToSentry } from "@/lib/observability/sentry-forwarder";

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

interface ApiKeyRow {
  user_id: string;
  is_active: boolean;
  expires_at: string | null;
}

/**
 * Validate API key from Authorization header or x-api-key header.
 * If neither header is present, falls back to Better Auth session cookie.
 * Returns userId if valid, error message + errorType if not.
 *
 * HTTP status mapping:
 *   invalid_key / missing_credentials → 401
 *   inactive                          → 403
 *   db_unreachable                    → 503
 *
 * Use apiKeyAuthErrorResponse(auth) to build a NextResponse automatically.
 */
export async function validateMissionApiKey(
  authHeader: string | null,
  xApiKey: string | null,
): Promise<ApiKeyAuthResult> {
  let rawKey: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    rawKey = authHeader.substring(7).trim();
    if (rawKey === "") {
      rawKey = null;
    }
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  }

  // No API key headers present — fall back to session cookie (browser EventSource path).
  // Browser EventSource cannot send custom headers; Better Auth cookie is sent automatically.
  if (!rawKey) {
    try {
      const user = await getCurrentUser();
      if (user) {
        return { valid: true, userId: user.id };
      }
    } catch (err) {
      logger.error(
        "[ApiKeyAuth] Session fallback error",
        err instanceof Error ? err : new Error(String(err)),
      );
    }
    // Fire-and-forget Sentry tag for missing_credentials (low severity)
    void forwardToSentry({
      level: "warning",
      message: "[ApiKeyAuth] missing_credentials",
      tags: { "auth.error_type": "missing_credentials" },
    });
    return {
      valid: false,
      error:
        "Missing API key. Provide Authorization: Bearer <key> header or authenticate via session.",
      errorType: "missing_credentials",
    };
  }

  try {
    const keyHash = sha256(rawKey);
    const db = createServerClient();

    const { data } = (await db
      .from("raas_api_keys")
      .select("user_id, is_active, expires_at")
      .eq("key_hash", keyHash)
      .single()) as { data: ApiKeyRow | null; error: unknown };

    if (!data) {
      void forwardToSentry({
        level: "warning",
        message: "[ApiKeyAuth] invalid_key",
        tags: { "auth.error_type": "invalid_key" },
      });
      return {
        valid: false,
        error: "Invalid API key",
        errorType: "invalid_key",
      };
    }

    if (!data.is_active) {
      void forwardToSentry({
        level: "warning",
        message: "[ApiKeyAuth] inactive key",
        tags: { "auth.error_type": "inactive" },
      });
      return {
        valid: false,
        error: "API key is inactive",
        errorType: "inactive",
      };
    }

    if (data.expires_at && Date.now() >= new Date(data.expires_at).getTime()) {
      return {
        valid: false,
        error: "API key has expired",
        errorType: "inactive",
      };
    }
    return { valid: true, userId: data.user_id };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("[ApiKeyAuth] Validation error", error);
    // Sentry tag: db_unreachable — operational issue, higher severity
    void forwardToSentry({
      level: "error",
      message: "[ApiKeyAuth] db_unreachable",
      tags: { "auth.error_type": "db_unreachable" },
      extra: { errorMessage: error.message },
    });
    return {
      valid: false,
      error: "Authentication error",
      errorType: "db_unreachable",
    };
  }
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
