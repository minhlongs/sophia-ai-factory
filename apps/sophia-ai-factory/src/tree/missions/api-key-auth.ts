/**
 * API Key Authentication for /api/v1/missions
 *
 * Primary path: validates Authorization: Bearer <key> or x-api-key header
 * against raas_api_keys table (SHA-256 hash comparison). Used by external API clients.
 *
 * Fallback path: session cookie auth via getCurrentUser(). Used by browser
 * clients (e.g. RenderProgress EventSource) that cannot send custom headers.
 * Ownership check is enforced separately by the route (mission.user_id === userId).
 */

import { createServerClient } from "@/seed/db/client";
import { sha256 } from "@/tree/audit/crypto-utils";
import { logger } from "@/seed/utils/logger-utility";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { forwardToSentry } from '@/seed/observability/sentry-forwarder';
import { extractRawApiKey, type ApiKeyAuthResult, type ApiKeyRow } from "./api-key-auth-helpers";

export {
  apiKeyAuthErrorResponse,
  type ApiKeyAuthErrorType,
  type ApiKeyAuthResult,
} from "./api-key-auth-helpers";

/**
 * Validate API key from Authorization header or x-api-key header.
 * If neither header is present, falls back to Better Auth session cookie.
 * Returns userId if valid, error message + errorType if not.
 */
export async function validateMissionApiKey(
  authHeader: string | null,
  xApiKey: string | null,
): Promise<ApiKeyAuthResult> {
  const rawKey = extractRawApiKey(authHeader, xApiKey);

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
      void forwardToSentry({
        level: "error",
        message: "[ApiKeyAuth] db_unreachable",
        tags: { "auth.error_type": "db_unreachable" },
        extra: { errorMessage: err instanceof Error ? err.message : String(err) },
      });
      return {
        valid: false,
        error: "Authentication error",
        errorType: "db_unreachable",
      };
    }
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
