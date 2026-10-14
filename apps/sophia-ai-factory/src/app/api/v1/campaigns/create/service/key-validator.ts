/**
 * RaaS API Key Validation Helpers
 *
 * Layer: app/api/v1/campaigns/create/service
 */

import { createServerClient } from "@/seed/db/client";
import type { RaasApiKeyValidationResult } from "./types";

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

export async function validateRaasApiKey(apiKey: string): Promise<RaasApiKeyValidationResult> {
  const db = createServerClient();

  // Hash the incoming key for DB lookup
  const { createHash } = await import("crypto");
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const { data: rawData, error } = await db
    .from("raas_licenses")
    .select("id, is_revoked, expires_at, user_id")
    .eq("key_hash", keyHash)
    .single();
  const data = rawData as {
    id?: string;
    is_revoked?: boolean | number;
    expires_at?: number | null;
    user_id?: string | null;
  } | null;

  if (error || !data) return { valid: false, userId: null };
  // D1 stores BOOLEAN as INTEGER (1 = revoked)
  if (data.is_revoked === true || data.is_revoked === 1) return { valid: false, userId: null };

  // expires_at 0/null = perpetual
  if (data.expires_at && data.expires_at > 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > data.expires_at) return { valid: false, userId: null };
  }

  const userId = data.user_id ?? null;
  return { valid: true, userId };
}
