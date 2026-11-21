/**
 * Canonical BASIC First-Value Journey Service (Track B1).
 *
 * Orchestrates:
 *   Sign in -> Choose org -> Configure 1 BYOK key -> Honest signed receipt
 *   -> Deterministic cost preview -> BASIC text script -> Review
 *   -> Explicit acceptance -> Private retrieval/export.
 *
 * @module land/first-value/basic-first-value-service
 */

import {
  buildFirstValueCostPreview,
  type FirstValueCostPreview,
} from '@/seed/ai/cost/first-value-cost-preview';
import {
  validateParsedScriptStructure,
  type ScriptOutput,
} from '@/seed/ai/script-generator';
import {
  createHonestValidationReceipt,
  verifyHonestValidationReceipt,
  type HonestValidationReceipt,
  type ProviderAuthStatus,
} from '@/tree/byok/honest-validation-receipt';
import {
  sanitizeCredential,
  validateProviderKey,
  type ValidatorProvider,
} from '@/tree/byok/key-format-validators';
import { maskApiKey } from '@/tree/byok/provider-health-checker';
import {
  buildDeterministicFixtureScript,
  getProvenanceLabel,
  renderFirstValueMarkdown,
  type FirstValuePrivateExport,
  type FirstValueScriptArtifact,
  type FirstValueSessionContext,
} from '@/tree/first-value/first-value-contract';
import {
  FirstValueFunnelCollector,
  type AbandonmentOrErrorCategory,
} from '@/tree/first-value/funnel-metrics';
import type {
  BasicFirstValueDeps,
  ConfigureByokInput,
  FirstValueErrorCode,
  FirstValueResult,
  GenerateForReviewInput,
  PreviewCostInput,
  RetrievePrivateScriptInput,
  ReviewScriptInput,
} from './basic-first-value-types';

const ALLOWED_BYOK_PROVIDERS = new Set<string>([
  'openrouter',
  'openai',
  'anthropic',
  'google',
  'gemini',
  'elevenlabs',
  'did',
]);

/**
 * NOTE: In-memory `artifacts`, `byIdempotency`, and `inFlight` maps are scoped to
 * deterministic B1 contract verification. Before wiring this service to multi-isolate
 * Cloudflare Worker HTTP mutations, back these maps with D1 durable storage.
 */
export class BasicFirstValueService {
  private readonly deps: BasicFirstValueDeps;
  private readonly collector: FirstValueFunnelCollector;
  private readonly artifacts = new Map<string, FirstValueScriptArtifact>();
  private readonly byIdempotency = new Map<string, FirstValueScriptArtifact>();
  private readonly inFlight = new Map<string, Promise<FirstValueResult<FirstValueScriptArtifact>>>();

  constructor(deps: BasicFirstValueDeps) {
    this.deps = deps;
    this.collector = deps.collector ?? new FirstValueFunnelCollector();
  }

  getFunnelCollector(): FirstValueFunnelCollector {
    return this.collector;
  }

  private now(): number {
    return this.deps.nowMs ? this.deps.nowMs() : Date.now();
  }

  private recordError(
    sessionId: string,
    orgId: string,
    stepNumber: number,
    errorCategory: AbandonmentOrErrorCategory,
    frictionCode?: string,
  ): void {
    this.collector.record({
      event: 'error_or_abandonment',
      orgId: orgId || 'unknown',
      sessionId,
      timestampMs: this.now(),
      stepNumber,
      errorCategory,
      ...(frictionCode ? { frictionCode } : {}),
    });
  }

  private async guardAuthAndOrg(
    sessionId: string,
    userId: string | null,
    orgId: string,
    stepNumber: number,
  ): Promise<{ ok: true; userId: string } | { ok: false; code: FirstValueErrorCode; error: string }> {
    if (!userId || !userId.trim()) {
      this.recordError(sessionId, orgId, stepNumber, 'unauthenticated');
      return { ok: false, code: 'UNAUTHENTICATED', error: 'Authentication required' };
    }
    if (!orgId || !orgId.trim() || !(await this.deps.verifyOrgMembership(orgId, userId))) {
      this.recordError(sessionId, orgId, stepNumber, 'wrong_organization');
      return { ok: false, code: 'WRONG_ORGANIZATION', error: 'Organization access denied' };
    }
    return { ok: true, userId };
  }

  async startJourney(args: {
    userId: string | null;
    orgId: string;
    sessionId?: string;
  }): Promise<FirstValueResult<FirstValueSessionContext>> {
    const sessionId = args.sessionId ?? crypto.randomUUID();
    const auth = await this.guardAuthAndOrg(sessionId, args.userId, args.orgId, 1);
    if (!auth.ok) return auth;

    const startedAtMs = this.now();
    this.collector.record({
      event: 'funnel_entry',
      orgId: args.orgId,
      sessionId,
      timestampMs: startedAtMs,
      stepNumber: 1,
    });

    return {
      ok: true,
      data: {
        sessionId,
        userId: auth.userId,
        orgId: args.orgId,
        startedAtMs,
        receipt: null,
        costPreview: null,
      },
    };
  }

  async configureByok(
    input: ConfigureByokInput,
  ): Promise<FirstValueResult<HonestValidationReceipt>> {
    const auth = await this.guardAuthAndOrg(input.sessionId, input.userId, input.orgId, 2);
    if (!auth.ok) return auth;

    const normalizedProvider = input.provider?.trim().toLowerCase() ?? '';
    if (!ALLOWED_BYOK_PROVIDERS.has(normalizedProvider)) {
      this.recordError(input.sessionId, input.orgId, 2, 'invalid_or_missing_byok', 'unsupported_provider');
      return { ok: false, code: 'INVALID_BYOK_FORMAT', error: 'Unsupported BYOK provider' };
    }

    const cleaned = sanitizeCredential(input.rawKey ?? '');
    const formatCheck = validateProviderKey(normalizedProvider as ValidatorProvider, cleaned);
    if (!formatCheck.ok) {
      this.recordError(input.sessionId, input.orgId, 2, 'invalid_or_missing_byok', 'key_format_invalid');
      return { ok: false, code: 'INVALID_BYOK_FORMAT', error: `Invalid ${normalizedProvider} key format` };
    }

    const finalKey = formatCheck.autoEncoded ?? cleaned;
    const maskedKey = maskApiKey(finalKey);

    try {
      await this.deps.storeEncryptedKey(auth.userId, input.orgId, normalizedProvider, finalKey);
    } catch {
      this.recordError(input.sessionId, input.orgId, 2, 'invalid_or_missing_byok', 'key_storage_failed');
      return { ok: false, code: 'BYOK_STORAGE_FAILED', error: 'Failed to store encrypted key' };
    }

    let providerAuthStatus: ProviderAuthStatus = 'untested';
    let probedCapabilities: HonestValidationReceipt['capabilities'] | undefined;
    if (input.verifyWithProvider && this.deps.probeProviderAuth) {
      try {
        const probe = await this.deps.probeProviderAuth(normalizedProvider, finalKey);
        providerAuthStatus = probe.status;
        probedCapabilities = probe.probedCapabilities;
      } catch {
        providerAuthStatus = 'unreachable';
      }
    }

    const receipt = await createHonestValidationReceipt({
      userId: auth.userId,
      orgId: input.orgId,
      provider: normalizedProvider,
      maskedKey,
      keyFormatAccepted: true,
      keyStoredSecurely: true,
      providerAuthStatus,
      probedCapabilities,
      policyStatus: 'found',
      costBasis: 'estimated',
      nowUnix: Math.floor(this.now() / 1000),
      signingSecret: this.deps.signingSecret,
    });

    this.collector.record({
      event: 'byok_setup_completed',
      orgId: input.orgId,
      sessionId: input.sessionId,
      timestampMs: this.now(),
      stepNumber: 2,
    });
    this.collector.record({
      event: 'validation_receipt_issued',
      orgId: input.orgId,
      sessionId: input.sessionId,
      timestampMs: this.now(),
      stepNumber: 2,
      receiptAuthStatus: receipt.providerAuthStatus,
      ...(receipt.providerAuthStatus === 'untested' ? { frictionCode: 'provider_auth_untested' } : {}),
    });

    return { ok: true, data: receipt };
  }

  async previewCost(input: PreviewCostInput): Promise<FirstValueResult<FirstValueCostPreview>> {
    const auth = await this.guardAuthAndOrg(input.sessionId, input.userId, input.orgId, 3);
    if (!auth.ok) return auth;

    const receiptCheck = await verifyHonestValidationReceipt(input.receipt, {
      userId: auth.userId,
      orgId: input.orgId,
      signingSecret: this.deps.signingSecret,
    });
    if (!receiptCheck.valid) {
      this.recordError(input.sessionId, input.orgId, 3, 'tampered_receipt');
      return { ok: false, code: 'TAMPERED_RECEIPT', error: `Invalid receipt: ${receiptCheck.reason}` };
    }

    const preview = buildFirstValueCostPreview({
      provider: input.provider,
      model: input.model,
      topic: input.topic,
      audience: input.audience,
      durationSec: input.durationSec,
      capabilitiesKnown: input.receipt.capabilitiesKnown,
      customRateCard: input.customRateCard,
    });

    this.collector.record({
      event: 'cost_preview_viewed',
      orgId: input.orgId,
      sessionId: input.sessionId,
      timestampMs: this.now(),
      stepNumber: 3,
      costPreviewStatus: preview.status,
      ...(preview.status === 'COST_ESTIMATE_UNAVAILABLE'
        ? { errorCategory: 'missing_price_data', frictionCode: 'missing_price_data' }
        : {}),
    });

    return { ok: true, data: preview };
  }

  async generateScriptForReview(
    input: GenerateForReviewInput,
  ): Promise<FirstValueResult<FirstValueScriptArtifact>> {
    const auth = await this.guardAuthAndOrg(input.sessionId, input.userId, input.orgId, 4);
    if (!auth.ok) return auth;

    const trimmedKey = input.idempotencyKey?.trim() ?? '';
    if (!trimmedKey) {
      this.recordError(input.sessionId, input.orgId, 4, 'invalid_script_schema', 'missing_idempotency_key');
      return { ok: false, code: 'INVALID_SCRIPT_SCHEMA', error: 'Non-empty idempotencyKey required' };
    }

    const receiptCheck = await verifyHonestValidationReceipt(input.receipt, {
      userId: auth.userId,
      orgId: input.orgId,
      signingSecret: this.deps.signingSecret,
    });
    if (!receiptCheck.valid || !input.receipt.keyStoredSecurely) {
      this.recordError(input.sessionId, input.orgId, 4, 'tampered_receipt');
      return { ok: false, code: 'TAMPERED_RECEIPT', error: 'Validation receipt rejected' };
    }

    const dedupeKey = `${input.orgId}:${auth.userId}:${input.mode}:${trimmedKey}`;
    const existing = this.byIdempotency.get(dedupeKey);
    if (existing) return { ok: true, data: existing };

    const pending = this.inFlight.get(dedupeKey);
    if (pending) return pending;

    const work = this.executeGeneration(input, auth.userId, dedupeKey);
    this.inFlight.set(dedupeKey, work);
    try {
      return await work;
    } finally {
      this.inFlight.delete(dedupeKey);
    }
  }

  private async resolveRawScript(
    input: GenerateForReviewInput,
    userId: string,
  ): Promise<FirstValueResult<unknown>> {
    if (input.mode === 'fixture_simulated') {
      return {
        ok: true,
        data: buildDeterministicFixtureScript(input.topic, input.audience, input.durationSec),
      };
    }

    if (!input.authorizePaidInference) {
      this.recordError(input.sessionId, input.orgId, 4, 'paid_inference_not_authorized');
      return {
        ok: false,
        code: 'PAID_INFERENCE_NOT_AUTHORIZED',
        error: 'Explicit authorization required before paid provider inference',
      };
    }

    if (input.receipt.providerAuthStatus !== 'verified' || !this.deps.generateWithProvider) {
      this.recordError(input.sessionId, input.orgId, 4, 'invalid_or_missing_byok');
      return {
        ok: false,
        code: 'PROVIDER_AUTH_NOT_VERIFIED',
        error: 'Verified provider authorization required for live inference',
      };
    }

    try {
      const data = await this.deps.generateWithProvider({
        userId,
        orgId: input.orgId,
        provider: input.receipt.provider,
        model: input.model,
        topic: input.topic,
        audience: input.audience,
        durationSec: input.durationSec,
      });
      return { ok: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.recordError(input.sessionId, input.orgId, 4, 'provider_timeout');
      return { ok: false, code: 'PROVIDER_TIMEOUT', error: `Provider boundary error: ${msg}` };
    }
  }

  private async executeGeneration(
    input: GenerateForReviewInput,
    userId: string,
    dedupeKey: string,
  ): Promise<FirstValueResult<FirstValueScriptArtifact>> {
    const rawResult = await this.resolveRawScript(input, userId);
    if (!rawResult.ok) return rawResult;

    let validated: ScriptOutput;
    try {
      validated = validateParsedScriptStructure(rawResult.data, {
        minScenes: 3,
        targetDurationSec: input.durationSec,
      });
    } catch (err) {
      this.recordError(input.sessionId, input.orgId, 4, 'invalid_script_schema');
      return {
        ok: false,
        code: 'INVALID_SCRIPT_SCHEMA',
        error: err instanceof Error ? err.message : 'Invalid script schema',
      };
    }

    let mcuCharged = 0;
    if (input.mode === 'live_provider') {
      let charged = false;
      try {
        charged = await this.deps.chargeMcu({
          userId,
          orgId: input.orgId,
          missionId: dedupeKey,
          amount: 1,
        });
      } catch {
        charged = false;
      }
      if (!charged) {
        this.recordError(input.sessionId, input.orgId, 4, 'mcu_insufficient_or_failed');
        return { ok: false, code: 'MCU_INSUFFICIENT', error: 'Insufficient MCU balance' };
      }
      mcuCharged = 1;
    }

    const priorCount = Array.from(this.artifacts.values()).filter(
      (a) => a.sessionId === input.sessionId && a.orgId === input.orgId,
    ).length;

    const artifactId = crypto.randomUUID();
    let optionalNotificationDelivered = false;
    if (this.deps.notifyOptional) {
      try {
        await this.deps.notifyOptional({ userId, orgId: input.orgId, artifactId });
        optionalNotificationDelivered = true;
      } catch {
        optionalNotificationDelivered = false;
      }
    }

    const artifact: FirstValueScriptArtifact = {
      artifactId,
      sessionId: input.sessionId,
      userId,
      orgId: input.orgId,
      version: priorCount + 1,
      idempotencyKey: input.idempotencyKey,
      topic: input.topic,
      audience: input.audience,
      durationSec: input.durationSec,
      provenance: input.mode,
      provenanceLabel: getProvenanceLabel(input.mode),
      script: validated,
      reviewState: 'pending_review',
      acceptedAtIso: null,
      acceptedByUserId: null,
      rejectedAtIso: null,
      rejectionReason: null,
      publicPublished: false,
      mcuCharged,
      optionalNotificationDelivered,
      createdAtIso: new Date(this.now()).toISOString(),
    };

    this.artifacts.set(artifactId, artifact);
    this.byIdempotency.set(dedupeKey, artifact);

    this.collector.record({
      event: 'script_available_for_review',
      orgId: input.orgId,
      sessionId: input.sessionId,
      timestampMs: this.now(),
      stepNumber: 4,
      outcomeClass:
        input.mode === 'fixture_simulated' ? 'SIMULATED_FIRST_VALUE' : 'REAL_MODEL_FIRST_VALUE',
    });

    return { ok: true, data: artifact };
  }

  async reviewScript(
    input: ReviewScriptInput,
  ): Promise<FirstValueResult<FirstValueScriptArtifact>> {
    const auth = await this.guardAuthAndOrg(input.sessionId, input.userId, input.orgId, 5);
    if (!auth.ok) return auth;

    if (!input.explicitUserAction) {
      return {
        ok: false,
        code: 'EXPLICIT_USER_ACTION_REQUIRED',
        error: 'Acceptance or rejection requires an explicit user action',
      };
    }

    const existing = this.artifacts.get(input.artifactId);
    if (
      !existing ||
      existing.orgId !== input.orgId ||
      existing.userId !== auth.userId ||
      existing.sessionId !== input.sessionId
    ) {
      return { ok: false, code: 'ARTIFACT_NOT_FOUND', error: 'Script artifact not found' };
    }

    if (existing.reviewState !== 'pending_review') {
      return {
        ok: false,
        code: 'EXPLICIT_USER_ACTION_REQUIRED',
        error: `Script review already finalized as ${existing.reviewState}`,
      };
    }

    if (input.decision === 'accept' && (!existing.script || existing.script.scenes.length < 3)) {
      return { ok: false, code: 'INVALID_SCRIPT_SCHEMA', error: 'Cannot accept missing or invalid script' };
    }

    const nowIso = new Date(this.now()).toISOString();
    const updated: FirstValueScriptArtifact =
      input.decision === 'accept'
        ? {
            ...existing,
            reviewState: 'accepted',
            acceptedAtIso: nowIso,
            acceptedByUserId: auth.userId,
          }
        : {
            ...existing,
            reviewState: 'rejected',
            rejectedAtIso: nowIso,
            rejectionReason: input.reason ?? 'Rejected by user during review',
          };

    this.artifacts.set(updated.artifactId, updated);
    this.byIdempotency.set(
      `${updated.orgId}:${updated.userId}:${updated.provenance}:${updated.idempotencyKey}`,
      updated,
    );

    if (input.decision === 'accept') {
      this.collector.record({
        event: 'script_explicitly_accepted',
        orgId: input.orgId,
        sessionId: input.sessionId,
        timestampMs: this.now(),
        stepNumber: 5,
        outcomeClass:
          updated.provenance === 'live_provider'
            ? 'CUSTOMER_ACCEPTED_FIRST_VALUE'
            : 'SIMULATED_FIRST_VALUE',
      });
    } else {
      this.collector.record({
        event: 'script_rejected',
        orgId: input.orgId,
        sessionId: input.sessionId,
        timestampMs: this.now(),
        stepNumber: 5,
        errorCategory: 'user_rejected_script',
      });
    }

    return { ok: true, data: updated };
  }

  async retrievePrivateScript(
    input: RetrievePrivateScriptInput,
  ): Promise<FirstValueResult<FirstValuePrivateExport>> {
    const auth = await this.guardAuthAndOrg('private-export', input.userId, input.orgId, 6);
    if (!auth.ok) return auth;

    const existing = this.artifacts.get(input.artifactId);
    if (!existing || existing.orgId !== input.orgId || existing.userId !== auth.userId) {
      return { ok: false, code: 'ARTIFACT_NOT_FOUND', error: 'Script artifact not found' };
    }

    if (existing.reviewState !== 'accepted' && !input.allowPendingPreview) {
      return {
        ok: false,
        code: 'SCRIPT_NOT_ACCEPTED',
        error: 'Script must be explicitly accepted before private export',
      };
    }

    const content =
      input.format === 'markdown' ? renderFirstValueMarkdown(existing) : existing.script;

    return {
      ok: true,
      data: {
        artifactId: existing.artifactId,
        orgId: existing.orgId,
        version: existing.version,
        provenance: existing.provenance,
        provenanceLabel: existing.provenanceLabel,
        reviewState: existing.reviewState,
        publicPublished: false,
        cacheControl: 'private, no-store',
        format: input.format,
        content,
      },
    };
  }
}
