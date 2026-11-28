import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { NextRequest } from 'next/server';
import { generateScript } from '@/seed/ai/script-generator';
import { buildFirstValueCostPreview } from '@/seed/ai/cost/first-value-cost-preview';
import { computeCreatePayloadHash } from '@/tree/first-value/first-value-review-repo';
import { handleFirstValuePost, type FirstValueHttpDeps } from '../first-value-http-handler';
import { PILOT_POLICY_VERSION } from '@/seed/pilot/pilot-access-policy';

function createInMemoryFirstValueD1(): D1Database {
  const reviews = new Map<string, Record<string, unknown>>();
  const consents = new Map<string, Record<string, unknown>>();
  const quotas = new Map<string, { used: number; spend: number; lockUntil: number | null }>();

  const makeStmt = (sql: string, bound: unknown[] = []) => ({
    bind: (...args: unknown[]) => makeStmt(sql, args),
    first: async <T = unknown>(): Promise<T | null> => {
      if (sql.includes('FROM pilot_consents')) {
        const key = `${bound[0]}:${bound[1]}`;
        return (consents.get(key) as T) ?? null;
      }
      if (sql.includes('FROM first_value_reviews') && sql.includes('idempotency_key')) {
        const key = `${bound[0]}:${bound[1]}:${bound[2]}`;
        return (reviews.get(key) as T) ?? null;
      }
      if (sql.includes('FROM pilot_usage_quotas')) {
        const key = `${bound[0]}:${bound[1]}`;
        const q = quotas.get(key);
        if (!q) return null;
        return {
          used_generations: q.used,
          estimated_spend_micro_usd: q.spend,
          last_generation_at_iso: null,
          in_flight_lock_until_ms: q.lockUntil,
        } as T;
      }
      return null;
    },
    all: async <T = unknown>() => ({ results: [] as T[] }),
    run: async () => {
      if (sql.includes('INSERT INTO pilot_consents')) {
        consents.set(`${bound[0]}:${bound[1]}`, {
          org_id: bound[0],
          user_id: bound[1],
          policy_version: bound[2],
          accepted_at_iso: bound[3],
        });
        return { success: true, meta: { changes: 1 } };
      }
      if (sql.includes('INSERT INTO pilot_usage_quotas')) {
        const key = `${bound[0]}:${bound[1]}`;
        if (!quotas.has(key)) quotas.set(key, { used: 0, spend: 0, lockUntil: null });
        return { success: true, meta: { changes: 1 } };
      }
      if (sql.includes('UPDATE pilot_usage_quotas')) {
        const key = `${bound[bound.length - 2]}:${bound[bound.length - 1]}`;
        const q = quotas.get(key) ?? { used: 0, spend: 0, lockUntil: null };
        if (sql.includes('used_generations = used_generations + 1')) {
          q.used += 1;
        }
        q.lockUntil = null;
        quotas.set(key, q);
        return { success: true, meta: { changes: 1 } };
      }
      if (sql.includes('INSERT INTO first_value_reviews')) {
        const key = `${bound[1]}:${bound[2]}:${bound[4]}`;
        if (reviews.has(key)) {
          return { success: true, meta: { changes: 0 } };
        }
        reviews.set(key, {
          artifact_id: bound[0],
          org_id: bound[1],
          user_id: bound[2],
          mission_id: bound[3],
          idempotency_key: bound[4],
          payload_hash: bound[5],
          provenance: bound[6],
          provenance_label: bound[7],
          review_state: 'pending_review',
          version: 1,
          topic: bound[8],
          audience: bound[9],
          duration_sec: bound[10],
          script_json: bound[11],
          private_artifact_ref: bound[12],
          receipt_id: bound[13],
          mcu_accounting_ref: bound[14],
          mcu_charged: bound[15],
          accepted_at_iso: null,
          accepted_by_user_id: null,
          rejected_at_iso: null,
          rejection_reason: null,
          created_at_iso: bound[16],
          updated_at_iso: bound[17],
        });
        return { success: true, meta: { changes: 1 } };
      }
      return { success: true, meta: { changes: 1 } };
    },
  });

  return {
    prepare: (sql: string) => makeStmt(sql),
  } as unknown as D1Database;
}

describe('Wave C.4.1 G1+G2: End-to-end referenceScript propagation, idempotency, and cost integrity', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('propagates distinctive referenceScript from HTTP -> handler -> pilot actions -> generateScript -> outbound OpenRouter request messages as untrusted customer content', async () => {
    const d1 = createInMemoryFirstValueD1();
    const capturedOpenRouterBodies: Array<{ url: string; body: Record<string, unknown> }> = [];
    const MARKER = 'WAVE_C41_UNIQUE_REFERENCE_MARKER_987654';
    const REF_SCRIPT = `Cảnh 1: Kiểm tra 2FA phần cứng (${MARKER}).\nCảnh 2: Không cam kết lợi nhuận.`;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('openrouter.ai/api/v1/chat/completions')) {
        const parsed = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        capturedOpenRouterBodies.push({ url, body: parsed });
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: 'Bảo mật Crypto An Toàn',
                    total_duration: 30,
                    scenes: [
                      { scene_number: 1, title: 'Hook', visual_description: 'Phone 2FA', narration: 'Kiểm tra 2FA phần cứng ngay.', duration_estimate: 10 },
                      { scene_number: 2, title: 'Core', visual_description: 'Cold wallet', narration: 'Tách ví lạnh và không cam kết lợi nhuận.', duration_estimate: 10 },
                      { scene_number: 3, title: 'CTA', visual_description: 'Checklist', narration: 'Tải checklist bảo mật tại liên kết.', duration_estimate: 10 },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      throw new Error(`Unexpected external fetch: ${url}`);
    }) as unknown as typeof fetch;

    // Seed consent
    await d1
      .prepare('INSERT INTO pilot_consents VALUES (?, ?, ?, ?)')
      .bind('org-c41', 'user-c41', PILOT_POLICY_VERSION, '2026-11-28T00:00:00.000Z')
      .run();

    const deps: FirstValueHttpDeps = {
      getD1: async () => d1,
      getCurrentUser: async () => ({ id: 'user-c41', email: 'pilot@example.test' }),
      verifyWorkspaceAccess: async () => true,
      verifyCsrf: () => true,
      listByokProviders: async () => ['openrouter'],
      signingSecret: 'test-signing-secret-0123456789abcdef',
      pilotEnv: {
        PILOT_INVITE_ONLY: 'true',
        PILOT_ALLOWED_EMAILS: 'pilot@example.test',
        PILOT_LIVE_INFERENCE_ENABLED: 'true',
        PILOT_FINANCING_MODE: 'CUSTOMER_BYOK',
        PILOT_MODEL_ID: 'openai/gpt-4o-mini',
        PILOT_MAX_GENERATIONS: '5',
        PILOT_MAX_ESTIMATED_SPEND_USD: '1.00',
        PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.01',
        PILOT_MAX_OUTPUT_TOKENS: '1000',
        PILOT_RATE_LIMIT_COOLDOWN_MS: '0',
        PILOT_TIMEOUT_MS: '15000',
        PILOT_MAX_RETRIES: '0',
      },
      lookupOpenRouterByokKey: async () => 'sk-or-v1-test-byok-key-000000000000',
      generateLiveScript: async (input) =>
        generateScript(
          {
            topic: input.topic,
            audience: input.audience,
            tier: 'BASIC',
            durationSec: input.durationSec,
            referenceScript: input.referenceScript,
            userId: input.userId,
          },
          {
            funding: { fund: 'byok', apiKey: input.apiKey },
            minScenes: 3,
            model: input.model,
            maxTokens: input.maxTokens,
            maxRetries: 0,
            timeoutMs: input.timeoutMs,
            referer: input.referer,
          },
        ),
    };

    const req1 = new NextRequest('http://127.0.0.1:8788/api/first-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-c41-0001' },
      body: JSON.stringify({
        action: 'create_review',
        orgId: 'org-c41',
        missionId: 'mission-c41',
        topic: 'Bảo mật sàn crypto',
        audience: 'Người mới',
        durationSec: 30,
        referenceScript: REF_SCRIPT,
        provenance: 'live_provider',
      }),
    });

    const res1 = await handleFirstValuePost(req1, deps);
    expect(res1.status).toBe(201);
    expect(capturedOpenRouterBodies).toHaveLength(1);

    const outboundMessages = capturedOpenRouterBodies[0]?.body.messages as Array<{
      role: string;
      content: string;
    }>;
    const serializedUserContent = outboundMessages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');

    expect(serializedUserContent).toContain('<customer_reference_script>');
    expect(serializedUserContent).toContain(MARKER);
    expect(serializedUserContent).toContain('UNTRUSTED CUSTOMER CONTENT');

    // G2a: Same idempotency key + same referenceScript -> replay without duplicate provider execution
    const req2 = new NextRequest('http://127.0.0.1:8788/api/first-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-c41-0001' },
      body: JSON.stringify({
        action: 'create_review',
        orgId: 'org-c41',
        missionId: 'mission-c41',
        topic: 'Bảo mật sàn crypto',
        audience: 'Người mới',
        durationSec: 30,
        referenceScript: REF_SCRIPT,
        provenance: 'live_provider',
      }),
    });
    const res2 = await handleFirstValuePost(req2, deps);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { idempotentReplay?: boolean };
    expect(body2.idempotentReplay).toBe(true);
    expect(capturedOpenRouterBodies).toHaveLength(1);

    // G2b: Same idempotency key + changed referenceScript -> 409 conflict, no silent replay
    const req3 = new NextRequest('http://127.0.0.1:8788/api/first-value', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-c41-0001' },
      body: JSON.stringify({
        action: 'create_review',
        orgId: 'org-c41',
        missionId: 'mission-c41',
        topic: 'Bảo mật sàn crypto',
        audience: 'Người mới',
        durationSec: 30,
        referenceScript: 'CHANGED_REFERENCE_SCRIPT_CONTENT',
        provenance: 'live_provider',
      }),
    });
    const res3 = await handleFirstValuePost(req3, deps);
    expect(res3.status).toBe(409);
    const body3 = (await res3.json()) as { code?: string };
    expect(body3.code).toBe('IDEMPOTENCY_PAYLOAD_CONFLICT');
    expect(capturedOpenRouterBodies).toHaveLength(1);
  });

  it('preserves exact legacy computeCreatePayloadHash when referenceScript is omitted and accounts for referenceScript in cost preview', async () => {
    const legacyHash = await computeCreatePayloadHash({
      missionId: 'm-1',
      topic: 'Topic',
      audience: 'Audience',
      durationSec: 30,
      provenance: 'fixture_simulated',
    });
    const emptyRefHash = await computeCreatePayloadHash({
      missionId: 'm-1',
      topic: 'Topic',
      audience: 'Audience',
      durationSec: 30,
      provenance: 'fixture_simulated',
      referenceScript: '   ',
    });
    const withRefHash = await computeCreatePayloadHash({
      missionId: 'm-1',
      topic: 'Topic',
      audience: 'Audience',
      durationSec: 30,
      provenance: 'fixture_simulated',
      referenceScript: 'Custom reference script',
    });

    expect(emptyRefHash).toBe(legacyHash);
    expect(withRefHash).not.toBe(legacyHash);

    const baseCost = buildFirstValueCostPreview({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      topic: 'Crypto Security',
      audience: 'Beginners',
      durationSec: 30,
    });
    const withRefCost = buildFirstValueCostPreview({
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      topic: 'Crypto Security',
      audience: 'Beginners',
      durationSec: 30,
      referenceScript: 'A'.repeat(1200),
    });

    expect(baseCost.status).toBe('COST_ESTIMATE_AVAILABLE');
    expect(withRefCost.status).toBe('COST_ESTIMATE_AVAILABLE');
    if (baseCost.status === 'COST_ESTIMATE_AVAILABLE' && withRefCost.status === 'COST_ESTIMATE_AVAILABLE') {
      expect(withRefCost.tokenAssumptions.inputTokens).toBeGreaterThan(baseCost.tokenAssumptions.inputTokens);
      expect(withRefCost.estimatedCostRangeUsd.minUsd).toBeGreaterThan(baseCost.estimatedCostRangeUsd.minUsd);
    }
  });
});
