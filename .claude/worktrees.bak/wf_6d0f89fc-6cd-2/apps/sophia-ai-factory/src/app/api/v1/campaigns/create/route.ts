import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/seed/db/client";
import { logger } from "@/seed/utils/logger-utility";
import { toError } from "@/seed/utils/to-error";
import { sendCampaignCreatedEvent } from "@/land/campaigns/create-campaign-core";
import { withRateLimit } from "@/forest/middleware/rate-limit-wrapper";
import { UNIFIED_TIERS } from "@/seed/config/tiers/unified-limits";

// POST /api/v1/campaigns/create
// Headers: Authorization: Bearer <raas_api_key>
// Body: { script, title?, avatar_id?, voice_id?, userId? }
// userId in body is IGNORED — identity is derived from the API key's owner (raas_licenses.user_id).
// If body provides userId and it mismatches the key owner → 403.
// Response: { campaignId, status: 'queued' }

export const createCampaignBodySchema = z.object({
  script: z.string().min(1, "script is required"),
  title: z.string().optional(),
  avatar_id: z.string().optional(),
  voice_id: z.string().optional(),
  // userId is OPTIONAL in body — the authoritative userId comes from the API key's license record.
  // Providing it is allowed only for forward-compatibility; any mismatch triggers a 403.
  userId: z.string().optional(),
});

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

interface RaasApiKeyValidationResult {
  valid: boolean;
  /** userId derived from the license record (raas_licenses.user_id). Null if key invalid. */
  userId: string | null;
  orgId?: string | null;
}

async function validateRaasApiKey(apiKey: string): Promise<RaasApiKeyValidationResult> {
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

// Campaign create dispatches Inngest video pipeline (LLM + TTS + render costs).
// 30/min ceiling — tier-config can lift higher.
export const POST = withRateLimit(async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const log = logger.withRequestId(requestId);

  try {
    const authHeader = request.headers.get("Authorization");
    const apiKey = extractBearerToken(authHeader);

    if (!apiKey) {
      log.warn("RaaS campaign create: missing or malformed Authorization header");
      return NextResponse.json(
        { error: "Authorization header with Bearer token is required" },
        { status: 401 }
      );
    }

    const keyResult = await validateRaasApiKey(apiKey);
    if (!keyResult.valid) {
      log.warn("RaaS campaign create: invalid or expired API key");
      return NextResponse.json(
        { error: "Invalid or expired API key" },
        { status: 401 }
      );
    }

    // userId is bound to the API key — never trust body.userId as authoritative identity
    const keyUserId = keyResult.userId;
    if (!keyUserId) {
      log.warn("RaaS campaign create: API key has no associated user");
      return NextResponse.json(
        { error: "API key is not bound to a user account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createCampaignBodySchema.safeParse(body);

    if (!parsed.success) {
      log.warn("RaaS campaign create: validation failed", {
        errors: parsed.error.flatten().fieldErrors,
      });
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Impersonation guard: if caller explicitly provides a userId that differs from the key owner → 403
    if (parsed.data.userId && parsed.data.userId !== keyUserId) {
      log.warn("RaaS campaign create: userId in body mismatches key owner", {
        bodyUserId: parsed.data.userId,
        keyUserId,
      });
      return NextResponse.json(
        { error: "userId in request body does not match the API key owner" },
        { status: 403 }
      );
    }

    // Always use the key-derived userId, never body.userId
    const userId = keyUserId;
    const { script, title } = parsed.data;

    // ── Org-aware quota check ────────────────────────────────────────────────
    const { resolveUserTier } = await import("@/seed/db/resolve-user-tier");
    const tier = await resolveUserTier(userId);

    // Determine org context (if any)
    const { getOrgIdForUser } = await import("@/forest/quota/org-quota-checker");
    const orgId = await getOrgIdForUser(userId);
    const useOrgQuota = process.env.ENABLE_ORG_QUOTAS === '1' && orgId !== null;

    let monthLimit: number;
    let currentCount: number;

    if (useOrgQuota) {
      const { checkCampaignQuota } = await import("@/forest/quota/org-quota-checker");
      const result = await checkCampaignQuota(userId, orgId, tier);
      monthLimit = result.limit;
      currentCount = result.current;
    } else {
      // Legacy per-user check
      monthLimit = UNIFIED_TIERS[tier].campaignsPerMonth;
      if (monthLimit < 999) {
        const db = createServerClient();
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data } = await db
          .from("campaigns")
          .select("id")
          .eq("user_id", userId)
          .gte("created_at", startOfMonth.toISOString());
        currentCount = (data as { id: string }[] | null)?.length ?? 0;
      } else {
        currentCount = 0; // high tier effectively unlimited
      }
    }

    if (monthLimit < 999 && currentCount >= monthLimit) {
      log.warn("RaaS campaign create: monthly limit reached", { userId, orgId: orgId ?? undefined, currentCount, monthLimit });
      return NextResponse.json(
        { error: `Monthly campaign limit reached (${monthLimit}). Upgrade your plan for more.` },
        { status: 429 }
      );
    }
    // ─────────────────────────────────────────────────────────────────────────────

    const db = createServerClient();
    const { data: rawCampaign, error: insertError } = await db
      .from("campaigns")
      .insert({
        user_id: userId,
        title: title ?? "Untitled Campaign",
        topic: null,
        audience: null,
        status: "queued",
        script_content: { text: script },
      })
      .select("id")
      .single();
    const campaign = rawCampaign as { id: string } | null;

    if (insertError || !campaign) {
      log.error("RaaS campaign create: DB insert failed", insertError ? toError(insertError) : undefined);
      return NextResponse.json(
        { error: "Failed to create campaign record" },
        { status: 500 }
      );
    }

    // Send to Inngest; check config to determine response status
    const inngestConfigured = !!(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);

    if (inngestConfigured) {
      await sendCampaignCreatedEvent({
        campaignId: campaign.id,
        userId,
        topic: title ?? "RaaS Campaign",
        audience: "general",
        tier: "BASIC",
      });
      log.info("RaaS campaign create: queued successfully", { campaignId: campaign.id, userId });
      return NextResponse.json({ campaignId: campaign.id, status: "queued" }, { status: 201 });
    }

    log.warn("RaaS campaign create: Inngest not configured, campaign saved but not queued", { campaignId: campaign.id });
    return NextResponse.json(
      { campaignId: campaign.id, status: "saved", message: "Background jobs not configured — campaign saved but not queued" },
      { status: 201 }
    );
  } catch (error) {
    logger.error(
      "RaaS campaign create: unexpected error",
      error instanceof Error ? error : undefined,
      {},
      requestId
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } });
