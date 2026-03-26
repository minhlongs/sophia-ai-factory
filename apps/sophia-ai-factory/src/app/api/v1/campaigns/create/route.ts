import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/logger-utility";
import { inngest } from "@/lib/inngest/client";

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
  const supabase = createAdminClient();

  // Hash the incoming key for comparison
  const { createHash } = await import("crypto");
  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const { data, error } = await supabase
    .from("raas_licenses")
    .select("id, is_revoked, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) return false;
  if (data.is_revoked) return false;

  // expires_at 0 = perpetual; null = perpetual
  if (data.expires_at && data.expires_at > 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec > data.expires_at) return false;
  }

  return true;
}

export async function POST(request: Request): Promise<NextResponse> {
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

    const supabase = createAdminClient();
    const { data: campaign, error: insertError } = await supabase
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

    if (insertError || !campaign) {
      log.error("RaaS campaign create: DB insert failed", insertError ?? undefined);
      return NextResponse.json(
        { error: "Failed to create campaign record" },
        { status: 500 }
      );
    }

    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaign.id,
        userId,
        topic: title ?? "RaaS Campaign",
        audience: "general",
        tier: "BASIC",
      },
    });

    log.info("RaaS campaign create: queued successfully", { campaignId: campaign.id, userId });

    return NextResponse.json({ campaignId: campaign.id, status: "queued" }, { status: 201 });
  } catch (error) {
    logger.error(
      "RaaS campaign create: unexpected error",
      error instanceof Error ? error : undefined,
      {},
      requestId
    );
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
