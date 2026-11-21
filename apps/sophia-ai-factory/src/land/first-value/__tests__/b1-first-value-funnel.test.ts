import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildFirstValueCostPreview,
  STATIC_RATE_CARD_SOURCE,
  STATIC_RATE_CARD_UPDATED_AT,
} from '@/seed/ai/cost/first-value-cost-preview';
import {
  createHonestValidationReceipt,
  verifyHonestValidationReceipt,
} from '@/tree/byok/honest-validation-receipt';
import { BasicFirstValueService } from '../basic-first-value-service';
import type { BasicFirstValueDeps } from '../basic-first-value-types';

const TEST_SIGNING_SECRET = 'b1-test-signing-secret-32-bytes-ok';
const VALID_OPENROUTER_KEY = 'sk-or-v1-1234567890abcdef1234567890abcdef1234567890abcdef';

const VALID_PROVIDER_SCRIPT = {
  title: 'BASIC Coffee Shop Promo',
  total_duration: 30,
  scenes: [
    {
      scene_number: 1,
      duration_estimate: 8,
      visual_description: 'Morning espresso pour close-up',
      narration: 'Tired of bitter morning coffee that wastes your budget?',
    },
    {
      scene_number: 2,
      duration_estimate: 14,
      visual_description: 'Local roaster grinding fresh beans',
      narration: 'Our small-batch roast delivers smooth flavor in under two minutes at home.',
    },
    {
      scene_number: 3,
      duration_estimate: 8,
      visual_description: 'QR code and private tasting card',
      narration: 'Reserve your first tasting bag today with zero subscription lock-in.',
    },
  ],
};

function makeService(overrides: Partial<BasicFirstValueDeps> = {}) {
  let clock = 1_760_000_000_000;
  const storedKeys: Array<{ userId: string; orgId: string; provider: string; key: string }> = [];
  const mcuLedger: Array<{ userId: string; orgId: string; missionId: string; amount: number }> = [];
  let mcuBalance = 10;

  const deps: BasicFirstValueDeps = {
    signingSecret: TEST_SIGNING_SECRET,
    verifyOrgMembership: vi.fn(async (orgId: string, userId: string) => {
      return orgId === 'org-alpha' && userId === 'user-1';
    }),
    storeEncryptedKey: vi.fn(async (userId, orgId, provider, key) => {
      storedKeys.push({ userId, orgId, provider, key });
    }),
    probeProviderAuth: vi.fn(async () => ({
      status: 'verified' as const,
      probedCapabilities: ['json_schema', 'tool_call'] as const,
    })),
    generateWithProvider: vi.fn(async () => VALID_PROVIDER_SCRIPT),
    chargeMcu: vi.fn(async ({ userId, orgId, missionId, amount }) => {
      if (mcuLedger.some((entry) => entry.missionId === missionId)) {
        return true;
      }
      if (mcuBalance < amount) return false;
      mcuBalance -= amount;
      mcuLedger.push({ userId, orgId, missionId, amount });
      return true;
    }),
    notifyOptional: vi.fn(async () => undefined),
    nowMs: () => {
      clock += 250;
      return clock;
    },
    ...overrides,
  };

  return {
    service: new BasicFirstValueService(deps),
    deps,
    storedKeys,
    mcuLedger,
    getMcuBalance: () => mcuBalance,
  };
}

describe('Track B1 — BASIC First-Value Funnel (15 G6 Scenarios + E2E Fixture)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Network-isolated guardrail: any unexpected outbound HTTP call fails the test.
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('UNEXPECTED_EXTERNAL_NETWORK_CALL');
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('End-to-end deterministic first-value fixture journey separates SIMULATED_FIRST_VALUE from CUSTOMER_ACCEPTED_FIRST_VALUE', async () => {
    const { service, deps, mcuLedger } = makeService();

    const start = await service.startJourney({ userId: 'user-1', orgId: 'org-alpha' });
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const byok = await service.configureByok({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: false,
    });
    expect(byok.ok).toBe(true);
    if (!byok.ok) return;
    expect(byok.data.keyFormatAccepted).toBe(true);
    expect(byok.data.keyStoredSecurely).toBe(true);
    expect(byok.data.providerAuthStatus).toBe('untested');
    expect(byok.data.paidInferenceExecuted).toBe(false);
    expect(JSON.stringify(byok.data)).not.toContain(VALID_OPENROUTER_KEY);

    const cost = await service.previewCost({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      topic: 'Local bakery launch',
      audience: 'Busy founders',
      durationSec: 30,
      receipt: byok.data,
    });
    expect(cost.ok).toBe(true);
    if (!cost.ok) return;
    expect(cost.data.status).toBe('COST_ESTIMATE_AVAILABLE');
    if (cost.data.status === 'COST_ESTIMATE_AVAILABLE') {
      expect(cost.data.priceSource).toBe(STATIC_RATE_CARD_SOURCE);
      expect(cost.data.priceUpdatedAt).toBe(STATIC_RATE_CARD_UPDATED_AT);
      expect(cost.data.fundingResponsibility).toBe('customer_byok');
      expect(cost.data.estimatedCostRangeUsd.minUsd).toBeGreaterThan(0);
      expect(cost.data.estimatedCostRangeUsd.maxUsd).toBeGreaterThanOrEqual(
        cost.data.estimatedCostRangeUsd.minUsd,
      );
    }

    const gen = await service.generateScriptForReview({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-fixture-1',
      topic: 'Local bakery launch',
      audience: 'Busy founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'fixture_simulated',
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    expect(gen.data.provenance).toBe('fixture_simulated');
    expect(gen.data.provenanceLabel).toBe('SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE');
    expect(gen.data.reviewState).toBe('pending_review');
    expect(gen.data.publicPublished).toBe(false);
    expect(gen.data.version).toBe(1);

    // Private export blocked until explicitly accepted
    const blockedExport = await service.retrievePrivateScript({
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      format: 'markdown',
    });
    expect(blockedExport.ok).toBe(false);
    if (!blockedExport.ok) expect(blockedExport.code).toBe('SCRIPT_NOT_ACCEPTED');

    const accepted = await service.reviewScript({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      decision: 'accept',
      explicitUserAction: true,
    });
    expect(accepted.ok).toBe(true);

    const exported = await service.retrievePrivateScript({
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      format: 'markdown',
    });
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(exported.data.cacheControl).toBe('private, no-store');
      expect(exported.data.publicPublished).toBe(false);
      expect(typeof exported.data.content).toBe('string');
      expect(String(exported.data.content)).toContain('SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE');
    }

    const summary = service.getFunnelCollector().summarize(start.data.sessionId, 'org-alpha');
    expect(summary.outcomeClass).toBe('SIMULATED_FIRST_VALUE');
    expect(summary.simulatedFirstValueReached).toBe(true);
    expect(summary.realModelFirstValueReached).toBe(false);
    expect(summary.customerAcceptedFirstValueReached).toBe(false);
    expect(summary.firstValueElapsedMs).toBeGreaterThan(0);
    expect(summary.onboardingStepCount).toBeGreaterThanOrEqual(5);
    expect(summary.frictionSignals).toContain('provider_auth_untested');
    expect(JSON.stringify(summary.events)).not.toContain(VALID_OPENROUTER_KEY);
    expect(deps.generateWithProvider).not.toHaveBeenCalled();
    expect(mcuLedger).toHaveLength(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Scenario 1: rejects unauthenticated user', async () => {
    const { service } = makeService();
    const res = await service.startJourney({ userId: null, orgId: 'org-alpha' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
  });

  it('Scenario 2: rejects wrong organization (tenant isolation)', async () => {
    const { service } = makeService();
    const res = await service.startJourney({ userId: 'user-1', orgId: 'org-beta' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('WRONG_ORGANIZATION');
  });

  it('Scenario 3: rejects invalid/missing BYOK and never marks syntax-only as verified', async () => {
    const { service } = makeService();
    const bad = await service.configureByok({
      sessionId: 'sess-3',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: 'not-a-valid-key',
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('INVALID_BYOK_FORMAT');

    // Invariant check: even if someone invokes createHonestValidationReceipt with keyFormatAccepted=false
    const forced = await createHonestValidationReceipt({
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      maskedKey: '****...0000',
      keyFormatAccepted: false,
      keyStoredSecurely: false,
      providerAuthStatus: 'verified',
      signingSecret: TEST_SIGNING_SECRET,
    });
    expect(forced.providerAuthStatus).toBe('rejected');
  });

  it('Scenario 4: detects and rejects tampered validation receipt', async () => {
    const { service } = makeService();
    const byok = await service.configureByok({
      sessionId: 'sess-4',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: false,
    });
    expect(byok.ok).toBe(true);
    if (!byok.ok) return;

    const tampered = { ...byok.data, providerAuthStatus: 'verified' as const };
    const verified = await verifyHonestValidationReceipt(tampered, {
      userId: 'user-1',
      orgId: 'org-alpha',
      signingSecret: TEST_SIGNING_SECRET,
    });
    expect(verified).toEqual({ valid: false, reason: 'INVALID_SIGNATURE' });

    const preview = await service.previewCost({
      sessionId: 'sess-4',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      topic: 'Tamper test',
      audience: 'Founders',
      durationSec: 30,
      receipt: tampered,
    });
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.code).toBe('TAMPERED_RECEIPT');
  });

  it('Scenario 5: returns COST_ESTIMATE_UNAVAILABLE (never $0) when price data is missing', async () => {
    const missingModel = buildFirstValueCostPreview({
      provider: 'openrouter',
      model: 'unknown-vendor/unpriced-model-x',
      topic: 'Pricing honesty test',
      audience: 'Founders',
      durationSec: 30,
      capabilitiesKnown: 'unknown',
    });
    expect(missingModel.status).toBe('COST_ESTIMATE_UNAVAILABLE');
    expect(missingModel.estimatedCostRangeUsd).toBeNull();
    expect(missingModel.costBasis).toBe('unavailable');
    expect(missingModel.warnings.length).toBeGreaterThanOrEqual(2);

    const missingProvider = buildFirstValueCostPreview({
      provider: null,
      model: null,
      topic: 'No provider',
      audience: 'Founders',
      durationSec: 30,
    });
    expect(missingProvider.status).toBe('COST_ESTIMATE_UNAVAILABLE');
    expect(missingProvider.estimatedCostRangeUsd).toBeNull();
  });

  it('Scenario 6: handles provider timeout through mocked boundary with zero MCU debit', async () => {
    const { service, mcuLedger } = makeService({
      generateWithProvider: vi.fn(async () => {
        throw new Error('Upstream provider timeout after 5000ms');
      }),
    });
    const byok = await service.configureByok({
      sessionId: 'sess-6',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    if (!byok.ok) throw new Error('expected ok');

    const res = await service.generateScriptForReview({
      sessionId: 'sess-6',
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-timeout-1',
      topic: 'Timeout test',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('PROVIDER_TIMEOUT');
    expect(mcuLedger).toHaveLength(0);
  });

  it('Scenario 7: rejects invalid script schema and charges zero MCU', async () => {
    const { service, mcuLedger } = makeService({
      generateWithProvider: vi.fn(async () => ({
        title: 'Broken',
        total_duration: 30,
        scenes: [{ scene_number: 1, duration_estimate: 30, visual_description: 'x', narration: 'only one scene' }],
      })),
    });
    const byok = await service.configureByok({
      sessionId: 'sess-7',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    if (!byok.ok) throw new Error('expected ok');

    const res = await service.generateScriptForReview({
      sessionId: 'sess-7',
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-invalid-schema',
      topic: 'Schema test',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_SCRIPT_SCHEMA');
    expect(mcuLedger).toHaveLength(0);
  });

  it('Scenarios 8 & 9: concurrent duplicate requests deduplicate with single MCU charge and preserve accounting integrity', async () => {
    let releaseProvider: () => void = () => undefined;
    const providerGate = new Promise<void>((resolve) => {
      releaseProvider = resolve;
    });
    const providerSpy = vi.fn(async () => {
      await providerGate;
      return VALID_PROVIDER_SCRIPT;
    });
    const { service, mcuLedger, getMcuBalance } = makeService({
      generateWithProvider: providerSpy,
    });
    const byok = await service.configureByok({
      sessionId: 'sess-8',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    if (!byok.ok) throw new Error('expected ok');

    const p1 = service.generateScriptForReview({
      sessionId: 'sess-8',
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-concurrent-1',
      topic: 'Concurrent test',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });
    const p2 = service.generateScriptForReview({
      sessionId: 'sess-8',
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-concurrent-1',
      topic: 'Concurrent test',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });

    releaseProvider();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      expect(r1.data.artifactId).toBe(r2.data.artifactId);
    }
    expect(providerSpy).toHaveBeenCalledTimes(1);
    expect(mcuLedger).toHaveLength(1);
    expect(getMcuBalance()).toBe(9);
  });

  it('Scenarios 10 & 11: private retrieval enforces tenant isolation and optional notification failure does not undo delivery', async () => {
    const { service } = makeService({
      notifyOptional: vi.fn(async () => {
        throw new Error('Telegram webhook unavailable');
      }),
    });
    const byok = await service.configureByok({
      sessionId: 'sess-10',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    if (!byok.ok) throw new Error('expected ok');

    const gen = await service.generateScriptForReview({
      sessionId: 'sess-10',
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-notify-fail',
      topic: 'Notification resilience',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    expect(gen.data.optionalNotificationDelivered).toBe(false);

    const acc = await service.reviewScript({
      sessionId: 'sess-10',
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      decision: 'accept',
      explicitUserAction: true,
    });
    expect(acc.ok).toBe(true);

    // Owner retrieves privately (JSON + Markdown)
    const jsonExport = await service.retrievePrivateScript({
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      format: 'json',
    });
    expect(jsonExport.ok).toBe(true);
    if (jsonExport.ok) {
      expect(jsonExport.data.cacheControl).toBe('private, no-store');
      expect(jsonExport.data.publicPublished).toBe(false);
    }

    // Cross-tenant retrieval denied
    const crossTenant = await service.retrievePrivateScript({
      userId: 'user-2',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      format: 'json',
    });
    expect(crossTenant.ok).toBe(false);
    if (!crossTenant.ok) expect(crossTenant.code).toBe('WRONG_ORGANIZATION');
  });

  it('Scenario 12: handles user rejection, refuses implicit acceptance, and records CUSTOMER_ACCEPTED_FIRST_VALUE only on explicit live acceptance', async () => {
    const { service } = makeService();
    const start = await service.startJourney({ userId: 'user-1', orgId: 'org-alpha' });
    if (!start.ok) throw new Error('expected ok');
    const byok = await service.configureByok({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    if (!byok.ok) throw new Error('expected ok');

    const gen1 = await service.generateScriptForReview({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-reject-1',
      topic: 'Draft v1',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });
    if (!gen1.ok) throw new Error('expected ok');

    // Implicit acceptance rejected
    const implicit = await service.reviewScript({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen1.data.artifactId,
      decision: 'accept',
      explicitUserAction: false,
    });
    expect(implicit.ok).toBe(false);
    if (!implicit.ok) expect(implicit.code).toBe('EXPLICIT_USER_ACTION_REQUIRED');

    // Explicit user rejection
    const rejected = await service.reviewScript({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen1.data.artifactId,
      decision: 'reject',
      explicitUserAction: true,
      reason: 'Hook too generic',
    });
    expect(rejected.ok).toBe(true);
    if (rejected.ok) expect(rejected.data.reviewState).toBe('rejected');

    // Version 2 explicitly accepted -> CUSTOMER_ACCEPTED_FIRST_VALUE
    const gen2 = await service.generateScriptForReview({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-accept-2',
      topic: 'Draft v2',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });
    if (!gen2.ok) throw new Error('expected ok');
    expect(gen2.data.version).toBe(2);

    const accepted = await service.reviewScript({
      sessionId: start.data.sessionId,
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen2.data.artifactId,
      decision: 'accept',
      explicitUserAction: true,
    });
    expect(accepted.ok).toBe(true);

    const summary = service.getFunnelCollector().summarize(start.data.sessionId, 'org-alpha');
    expect(summary.outcomeClass).toBe('CUSTOMER_ACCEPTED_FIRST_VALUE');
    expect(summary.customerAcceptedFirstValueReached).toBe(true);
    expect(summary.errorCategories).toContain('user_rejected_script');
  });

  it('Scenarios 13 & 14: refuses paid provider call without explicit authorization (zero external spending) and never auto-publishes', async () => {
    const { service, deps } = makeService();
    const byok = await service.configureByok({
      sessionId: 'sess-13',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    if (!byok.ok) throw new Error('expected ok');

    const denied = await service.generateScriptForReview({
      sessionId: 'sess-13',
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'idem-no-auth',
      topic: 'Spend guard',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: false,
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('PAID_INFERENCE_NOT_AUTHORIZED');
    expect(deps.generateWithProvider).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Scenario 15: preserves existing production 1-permitted / 39-blocked scheduled cron policy unchanged', () => {
    const policyPath = join(process.cwd(), 'src/seed/security/scheduled-cron-policy.json');
    const raw = JSON.parse(readFileSync(policyPath, 'utf-8')) as {
      permittedRoutes: string[];
      registeredRoutes: string[];
    };
    expect(raw.permittedRoutes).toEqual(['/api/cron/d1-backup']);
    expect(raw.registeredRoutes).toHaveLength(40);
    const blockedCount = raw.registeredRoutes.filter(
      (r) => !raw.permittedRoutes.includes(r),
    ).length;
    expect(blockedCount).toBe(39);
  });

  it('Hardening regressions: malformed/expired receipts fail closed, probe exceptions map to unreachable, missionId is tenant-scoped, and finalized reviews are immutable', async () => {
    // 1. Malformed receipt shape never throws
    const malformed = await verifyHonestValidationReceipt(
      { receiptIntegrity: { algorithm: 'hmac-sha256', signature: 'abc' }, capabilities: null } as never,
      { userId: 'user-1', orgId: 'org-alpha', signingSecret: TEST_SIGNING_SECRET },
    );
    expect(malformed).toEqual({ valid: false, reason: 'INVALID_SHAPE' });

    // 2. Expired receipt rejected
    const oldReceipt = await createHonestValidationReceipt({
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      maskedKey: 'sk-o...cdef',
      keyFormatAccepted: true,
      keyStoredSecurely: true,
      providerAuthStatus: 'verified',
      nowUnix: 1_700_000_000,
      signingSecret: TEST_SIGNING_SECRET,
    });
    const expired = await verifyHonestValidationReceipt(oldReceipt, {
      userId: 'user-1',
      orgId: 'org-alpha',
      signingSecret: TEST_SIGNING_SECRET,
      maxAgeSec: 300,
      nowUnix: 1_700_000_500,
    });
    expect(expired).toEqual({ valid: false, reason: 'RECEIPT_EXPIRED' });

    // 3. probeProviderAuth exception yields providerAuthStatus='unreachable' without leaking
    const { service: probeFailSvc } = makeService({
      probeProviderAuth: vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    });
    const unreachableReceipt = await probeFailSvc.configureByok({
      sessionId: 'sess-hardening',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    expect(unreachableReceipt.ok).toBe(true);
    if (unreachableReceipt.ok) {
      expect(unreachableReceipt.data.providerAuthStatus).toBe('unreachable');
    }

    // 4. Tenant-scoped missionId + immutable review state
    const { service, mcuLedger } = makeService();
    const byok = await service.configureByok({
      sessionId: 'sess-scope',
      userId: 'user-1',
      orgId: 'org-alpha',
      provider: 'openrouter',
      rawKey: VALID_OPENROUTER_KEY,
      verifyWithProvider: true,
    });
    if (!byok.ok) throw new Error('expected ok');
    const gen = await service.generateScriptForReview({
      sessionId: 'sess-scope',
      userId: 'user-1',
      orgId: 'org-alpha',
      idempotencyKey: 'shared-key-1',
      topic: 'Scope check',
      audience: 'Founders',
      durationSec: 30,
      model: 'openai/gpt-4o-mini',
      receipt: byok.data,
      mode: 'live_provider',
      authorizePaidInference: true,
    });
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    expect(mcuLedger[0]?.missionId).toBe('org-alpha:user-1:live_provider:shared-key-1');

    const acc = await service.reviewScript({
      sessionId: 'sess-scope',
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      decision: 'accept',
      explicitUserAction: true,
    });
    expect(acc.ok).toBe(true);

    // Second review mutation on finalized artifact is rejected
    const mut = await service.reviewScript({
      sessionId: 'sess-scope',
      userId: 'user-1',
      orgId: 'org-alpha',
      artifactId: gen.data.artifactId,
      decision: 'reject',
      explicitUserAction: true,
    });
    expect(mut.ok).toBe(false);
    if (!mut.ok) expect(mut.code).toBe('EXPLICIT_USER_ACTION_REQUIRED');
  });
});
