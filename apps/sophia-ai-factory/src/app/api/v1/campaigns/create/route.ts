import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/seed/utils/logger-utility";
import { withRateLimit } from "@/forest/middleware/rate-limit-wrapper";
import {
  createCampaignBodySchema,
  extractBearerToken,
  validateRaasApiKey,
  checkCampaignCreationQuota,
  ingestCampaignRecord,
} from "./service/index";

export { createCampaignBodySchema };

export const POST = withRateLimit(
  async function POST(request: NextRequest): Promise<NextResponse> {
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
        return NextResponse.json({ error: "Invalid or expired API key" }, { status: 401 });
      }

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

      const quota = await checkCampaignCreationQuota(keyUserId, log);
      if (!quota.allowed) {
        return NextResponse.json(
          {
            error: `Monthly campaign limit reached (${quota.monthLimit}). Upgrade your plan for more.`,
          },
          { status: 429 }
        );
      }

      const result = await ingestCampaignRecord({
        userId: keyUserId,
        title: parsed.data.title,
        script: parsed.data.script,
        log,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      return NextResponse.json(
        { campaignId: result.campaignId, status: result.status, message: result.message },
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
  },
  { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 30 } }
);
