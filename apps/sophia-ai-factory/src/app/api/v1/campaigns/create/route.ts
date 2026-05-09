import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/seed/db/client";
import { logger } from "@/seed/utils/logger-utility";
import { toError } from "@/seed/utils/to-error";
import { sendCampaignCreatedEvent } from "@/lib/campaigns/create-campaign-core";
import { withRateLimit } from "@/forest/middleware/rate-limit-wrapper";

// POST /api/v1/campaigns/create
// Headers: Authorization: Bearer <raas_api_key>
// Body: { script, title?, avatar_id?, voice_id?, userId }
// Response: { campaignId, status: 'queued' }

const createCampaignBodySchema = z.object({
  script: z.string().min(1, "script is required"),
  title: z.string().optional(),
  avatar_id: z.string().optional(),
  voice_id: z.string().optional(),
  userId: z.string().min(1, "userId is required"),
});

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}

async function validateRaasApiKey(apiKey: string): Promise<boolean> {
  const db = createServerClient();

  // Hash the incoming key for comparison
  const { createHash } = await import("crypto");
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const { data: rawData, error } = await db
    .from("raas_licenses")
    .select("id, is_revoked, expires_at")
    .eq("key_hash", keyHash)
    .single();
  const data = rawData as { id?: string; is_revoked?: boolean; expires_at?: number | null } | null;

  if (error || !data) return false;
  if (data.is_revoked) return false;

  // expires_at 0 = perpetual; null = perpetual
  if (data.expires_at && data.expires_at > 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > data.expires_at) return false;
  }

  return true;
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

    const isValid = await validateRaasApiKey(apiKey);
    if (!isValid) {
      log.warn("RaaS campaign create: invalid or expired API key");
      return NextResponse.json(
        { error: "Invalid or expired API key" },
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

    const { script, title, userId } = parsed.data;

    // TIER CHECK: Monthly campaign limit
    const { getUserTier } = await import("@/seed/db/get-user-tier");
    const { UNIFIED_TIERS } = await import("@/seed/config/tiers");
    const tier = await getUserTier(userId);
    const monthLimit = UNIFIED_TIERS[tier].campaignsPerMonth;

    if (monthLimit < 999) {
      const db = createServerClient();
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: countData } = await db
        .from("campaigns")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", startOfMonth.toISOString());

      const currentCount = (countData as { id: string }[] | null)?.length ?? 0;
      if (currentCount >= monthLimit) {
        log.warn("RaaS campaign create: monthly limit reached", { userId, currentCount, monthLimit });
        return NextResponse.json(
          { error: `Monthly campaign limit reached (${monthLimit}). Upgrade your plan for more.` },
          { status: 429 }
        );
      }
    }

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
