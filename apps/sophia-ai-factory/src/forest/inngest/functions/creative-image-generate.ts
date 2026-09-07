/**
 * Creative Image Generate — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Consumes `creative/image.requested`, resolves the MockImageGenerationProvider,
 * maps CreativeJob.input -> ImageGenerationInput at this single mapping point
 * (Escrow MED-2), generates the image, stores the asset in media_jobs, runs the
 * result gate, and emits `creative/image.completed` or `creative/image.failed`.
 *
 * V1 constraint: only the Mock provider is wired. Real providers (MuAPI,
 * OpenRouter) are added in later phases — do NOT import them here.
 *
 * Idempotency: if idempotencyKey already produced a completed asset, the
 * existing asset is returned without re-running the provider.
 *
 * @module forest/inngest/functions/creative-image-generate
 */

import { inngest } from "@/seed/inngest/client";
import { logger } from "@/seed/utils/logger-utility";
import {
  classifyError,
  type FailureKind,
} from "@/seed/types/failure-kind";
import {
  recordFailure,
  recordSuccess,
  shouldAllowRequest,
} from "@/seed/security/circuit-breaker";
import {
  type CreativeAsset,
  creativeAssetSchema,
  type ImageGenerationInput,
  type CreativeConstraints,
  DEFAULT_CREATIVE_CONSTRAINTS,
} from "@/seed/types/creative";
import type {
  ImageGenerationInput as ProviderInput,
  ImageGenerationProvider,
} from "@/seed/ai/image-generation-provider";
import { OpenRouterImageGenerationAdapter } from "@/seed/ai/providers/openrouter-image-generation-adapter";
import { createHash } from "node:crypto";
import { createServerClient } from "@/seed/db/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const PROVIDER_ID = "mock-image";
const BACKOFF_BASE_MS = 1000;

// ---------------------------------------------------------------------------
// Mock provider (STEP 4 placeholder — replaced when mock provider ships)
// ---------------------------------------------------------------------------

class InlineMockImageProvider implements ImageGenerationProvider {
  readonly id = PROVIDER_ID;
  readonly label = "Mock Image Provider";

  async generate(input: ProviderInput) {
    const start = Date.now();
    return {
      assetRef: `mock://image/${input.idempotencyKey ?? "default"}.png`,
      provider: this.id,
      costCents: 0,
      latencyMs: Date.now() - start,
      metadata: { mock: true },
    };
  }

  capabilities() {
    return { supportsAspectRatio: true, supportsStyle: true, maxConcurrency: 5 };
  }

  async health() {
    return { healthy: true, latencyMs: 10 };
  }
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the image generation provider based on environment configuration.
 *
 * If OPENROUTER_API_KEY is set, returns a real OpenRouterImageGenerationAdapter.
 * Otherwise, falls back to the InlineMockImageProvider for development/testing.
 *
 * This is the single resolution point — no other module decides which provider
 * to use for creative image generation.
 */
export function resolveImageProvider(): ImageGenerationProvider {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    return new OpenRouterImageGenerationAdapter({
      apiKey,
      label: 'OpenRouter Image Generation',
    });
  }
  return new InlineMockImageProvider();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computePromptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

function backoffMs(attempt: number): number {
  return BACKOFF_BASE_MS * 2 ** (attempt - 1);
}

/**
 * Map CreativeJob.input -> provider ImageGenerationInput.
 * This is the SINGLE mapping point per Escrow MED-2. No other module may
 * perform this mapping.
 */
function mapJobInputToProviderInput(
  jobInput: ImageGenerationInput,
  constraints: CreativeConstraints,
  idempotencyKey: string,
): ProviderInput {
  return {
    prompt: jobInput.prompt,
    aspectRatio: jobInput.aspectRatio,
    style: jobInput.style,
    idempotencyKey,
    timeoutMs: constraints.timeoutMs,
  };
}

/** Store asset into media_jobs D1 table (STEP 6 placeholder — replaced when asset-store ships). */
function storeAssetInMediaJobs(
  asset: CreativeAsset,
  missionId: string,
  userId: string,
): void {
  const db = createServerClient();
  db.prepare(
    `INSERT INTO media_jobs (id, user_id, type, model, prompt, status, result_url, created_at, completed_at, mission_id, provider, mime, size, prompt_hash, generated_at, metadata)
     VALUES (?1, ?2, 'image', ?3, ?4, 'completed', ?5, unixepoch(), unixepoch(), ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  )
    .bind(
      asset.id,
      userId,
      asset.provider,
      asset.promptHash,
      asset.url,
      missionId,
      asset.provider,
      asset.mime,
      asset.size,
      asset.promptHash,
      asset.generatedAt,
      JSON.stringify(asset.metadata ?? {}),
    )
    .run();
}

/** Run result gate (STEP 7 placeholder — replaced when result-gate ships). */
function verifyImageResult(asset: CreativeAsset): { ok: boolean; reason?: string } {
  const parsed = creativeAssetSchema.safeParse(asset);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  if (!asset.url.startsWith("mock://") && !asset.url.startsWith("http")) {
    return { ok: false, reason: "invalid_asset_url" };
  }
  if (!asset.mime.startsWith("image/")) {
    return { ok: false, reason: "invalid_mime_type" };
  }
  if (asset.size <= 0) {
    return { ok: false, reason: "invalid_size" };
  }
  return { ok: true };
}

/** Check idempotency: has this key already produced a completed asset? */
async function findExistingAsset(
  jobId: string,
): Promise<CreativeAsset | null> {
  const db = createServerClient();
  const row = await db
    .prepare(`SELECT id, job_id as jobId, url, mime, size, provider, prompt_hash as promptHash, generated_at as generatedAt FROM media_jobs WHERE id = ?1 AND status = 'completed'`)
    .bind(jobId)
    .first<{
      id: string;
      jobId: string;
      url: string;
      mime: string;
      size: number;
      provider: string;
      promptHash: string;
      generatedAt: string;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.jobId,
    url: row.url,
    mime: row.mime,
    size: row.size,
    provider: row.provider,
    promptHash: row.promptHash,
    generatedAt: row.generatedAt,
  };
}

// ---------------------------------------------------------------------------
// Inngest function
// ---------------------------------------------------------------------------

export const creativeImageGenerate = inngest.createFunction(
  {
    id: "creative-image-generate",
    retries: MAX_RETRIES,
  },
  { event: "creative/image.requested" },
  async ({ event, step }) => {
    const { jobId, missionId, userId, prompt, negativePrompt, aspectRatio, style, seed, idempotencyKey, constraints } = event.data;

    const constraintsResolved: CreativeConstraints = constraints ?? DEFAULT_CREATIVE_CONSTRAINTS;
    const idemKey = idempotencyKey ?? jobId;

    logger.info("creativeImageGenerate: received", { jobId, missionId, userId });

    // Idempotency check
    const existing = await step.run("check-idempotency", () => findExistingAsset(jobId));
    if (existing) {
      logger.info("creativeImageGenerate: idempotent hit, skipping", { jobId, assetId: existing.id });
      return { success: true, data: { jobId, asset: existing, idempotent: true } };
    }

    // Circuit breaker gate
    if (!shouldAllowRequest(PROVIDER_ID)) {
      logger.error("creativeImageGenerate: circuit breaker open", { jobId, provider: PROVIDER_ID });
      await inngest.send({
        name: "creative/image.failed",
        data: {
          jobId,
          missionId,
          userId,
          error: "Circuit breaker open",
          code: "CIRCUIT_OPEN",
          kind: "SERVER_ERROR" as FailureKind,
          attempt: 0,
        },
      });
      return { success: false, error: { code: "CIRCUIT_OPEN", message: "Circuit breaker open" } };
    }

    // Resolve provider (real OpenRouter if key set, otherwise mock)
    const provider: ImageGenerationProvider = resolveImageProvider();

    // Map job input -> provider input (Escrow MED-2: single mapping point)
    const providerInput = mapJobInputToProviderInput(
      { prompt, negativePrompt, aspectRatio, style, seed },
      constraintsResolved,
      idemKey,
    );

    // Execute with retry
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.info("creativeImageGenerate: attempting generation", { jobId, attempt });

        const result = await step.run(`generate-${attempt}`, () =>
          provider.generate(providerInput),
        );

        // Build CreativeAsset
        const promptHash = computePromptHash(prompt);
        const generatedAt = new Date().toISOString();
        const asset: CreativeAsset = {
          id: jobId,
          jobId,
          url: result.assetRef,
          mime: "image/png",
          size: 1024,
          provider: result.provider,
          promptHash,
          generatedAt,
          metadata: result.metadata,
        };

        // Store asset
        await step.run("store-asset", () =>
          storeAssetInMediaJobs(asset, missionId, userId),
        );

        // Run result gate
        const gateResult = await step.run("result-gate", () => verifyImageResult(asset));
        if (!gateResult.ok) {
          logger.error("creativeImageGenerate: result gate rejected", { jobId, reason: gateResult.reason });
          recordFailure(PROVIDER_ID, "SERVER_ERROR" as FailureKind);
          await inngest.send({
            name: "creative/image.failed",
            data: {
              jobId,
              missionId,
              userId,
              error: `Result gate rejected: ${gateResult.reason}`,
              code: "GATE_REJECTED",
              kind: "SERVER_ERROR" as FailureKind,
              attempt,
            },
          });
          return { success: false, error: { code: "GATE_REJECTED", message: gateResult.reason } };
        }

        // Record circuit breaker success
        recordSuccess(PROVIDER_ID);

        // Emit completion event
        await inngest.send({
          name: "creative/image.completed",
          data: {
            jobId,
            missionId,
            userId,
            assetRef: asset.url,
            provider: result.provider,
            costCents: result.costCents,
            latencyMs: result.latencyMs,
            promptHash,
            generatedAt,
          },
        });

        logger.info("creativeImageGenerate: completed", { jobId, assetId: asset.id });
        return { success: true, data: { jobId, asset } };
      } catch (err) {
        lastError = err;
        const kind = classifyError(err);
        const message = err instanceof Error ? err.message : String(err);

        logger.error("creativeImageGenerate: attempt failed", {
          jobId,
          attempt,
          kind,
          error: message,
        });

        recordFailure(PROVIDER_ID, kind);

        if (attempt < MAX_RETRIES) {
          const delay = backoffMs(attempt);
          logger.info("creativeImageGenerate: backing off before retry", { jobId, delay, attempt });
          await step.sleep(`backoff-${attempt}`, delay);
        }
      }
    }

    // All retries exhausted — emit failure
    const finalKind = classifyError(lastError);
    const finalMessage = lastError instanceof Error ? lastError.message : String(lastError);
    logger.error("creativeImageGenerate: all retries exhausted", {
      jobId,
      attempts: MAX_RETRIES,
      kind: finalKind,
      error: finalMessage,
    });

    await inngest.send({
      name: "creative/image.failed",
      data: {
        jobId,
        missionId,
        userId,
        error: finalMessage,
        code: "MAX_RETRIES_EXCEEDED",
        kind: finalKind,
        attempt: MAX_RETRIES,
      },
    });

    return { success: false, error: { code: "MAX_RETRIES_EXCEEDED", message: finalMessage } };
  },
);
