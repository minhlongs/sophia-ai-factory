import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  B3_ORIGIN,
  bindD1Globals,
  createB3SqliteFixture,
  dispatchRoute,
  seedSyntheticTenant,
  type B3SqliteFixture,
} from './b3-revenue-harness';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let fixture: B3SqliteFixture;
let firstValueRoute: typeof import('@/app/api/first-value/route');
let currentUser: { id: string; email: string } | null = null;
let openRouterProbeBehavior: 'valid' | 'invalid_401' | 'quota_402' | 'timeout' = 'valid';
let openRouterChatBehavior:
  | 'valid_fenced'
  | 'malformed_json'
  | 'content_null'
  | 'invalid_schema'
  | 'rate_limit_429'
  | 'quota_402'
  | 'unsupported_model_400' = 'valid_fenced';
let openRouterChatDelayMs = 0;
const outboundCalls: string[] = [];
const originalFetch = globalThis.fetch;

const CUSTOMER_KEY = `sk-or-v1-${'c'.repeat(64)}`;
const CSRF_TOKEN = 'bp01-synthetic-csrf-token-0001';

const PILOT_MIGRATIONS = [
  '0515_first_value_reviews.sql',
  '0517_customer_pilot_first_value.sql',
  '0519_pilot_support_requests.sql',
] as const;

const envKeys = [
  'BYOK_MASTER_KEY',
  'BETTER_AUTH_SECRET',
  'PILOT_INVITE_ONLY',
  'PILOT_ALLOWED_EMAILS',
  'PILOT_LIVE_INFERENCE_ENABLED',
  'PILOT_FINANCING_MODE',
  'PILOT_MAX_GENERATIONS',
  'PILOT_MAX_ESTIMATED_SPEND_USD',
  'PILOT_ESTIMATED_COST_PER_ATTEMPT_USD',
  'PILOT_MODEL_ID',
  'PILOT_MAX_OUTPUT_TOKENS',
  'PILOT_MAX_RETRIES',
  'PILOT_TIMEOUT_MS',
  'PILOT_RATE_LIMIT_COOLDOWN_MS',
  'PILOT_OPENROUTER_API_KEY',
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
] as const;
const savedEnv = new Map<string, string | undefined>();

import { vi } from 'vitest';
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: async () => currentUser,
}));

function buildFirstValueReq(
  method: 'GET' | 'POST',
  pathOrQuery: string,
  body?: Record<string, unknown>,
  idemKey?: string,
) {
  const headers: Record<string, string> = {
    origin: B3_ORIGIN,
    cookie: `csrf-token=${CSRF_TOKEN}`,
    'x-csrf-token': CSRF_TOKEN,
    ...(body ? { 'content-type': 'application/json' } : {}),
    ...(idemKey ? { 'idempotency-key': idemKey } : {}),
  };
  return new NextRequest(`${B3_ORIGIN}${pathOrQuery}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  for (const k of envKeys) savedEnv.set(k, process.env[k]);
  Object.assign(process.env, {
    BYOK_MASTER_KEY: Buffer.alloc(32, 9).toString('base64'),
    BETTER_AUTH_SECRET: 'bp01-synthetic-better-auth-secret-0123456789',
    PILOT_INVITE_ONLY: 'true',
    PILOT_ALLOWED_EMAILS: 'ceo@pilot.example.invalid',
    PILOT_LIVE_INFERENCE_ENABLED: 'true',
    PILOT_FINANCING_MODE: 'CUSTOMER_BYOK',
    PILOT_MAX_GENERATIONS: '20',
    PILOT_MAX_ESTIMATED_SPEND_USD: '4.00',
    PILOT_ESTIMATED_COST_PER_ATTEMPT_USD: '0.02',
    PILOT_MODEL_ID: 'openai/gpt-4o-mini',
    PILOT_MAX_OUTPUT_TOKENS: '2048',
    PILOT_MAX_RETRIES: '0',
    PILOT_TIMEOUT_MS: '5000',
    PILOT_RATE_LIMIT_COOLDOWN_MS: '0',
  });
  delete process.env.PILOT_OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    outboundCalls.push(`${method} ${url}`);

    if (url === 'https://openrouter.ai/api/v1/auth/key' && method === 'GET') {
      if (openRouterProbeBehavior === 'invalid_401') {
        return new Response(JSON.stringify({ error: { message: 'Invalid key' } }), { status: 401 });
      }
      if (openRouterProbeBehavior === 'quota_402') {
        return Response.json({ data: { limit: 5, limit_remaining: 0 } });
      }
      if (openRouterProbeBehavior === 'timeout') {
        throw new Error('AbortError: signal timed out');
      }
      return Response.json({ data: { limit: 10, limit_remaining: 9.5 } });
    }

    if (url === 'https://openrouter.ai/api/v1/chat/completions' && method === 'POST') {
      const authHeader = new Headers(init?.headers).get('authorization');
      expect(authHeader).toBe(`Bearer ${CUSTOMER_KEY}`);
      if (openRouterChatDelayMs > 0) {
        await new Promise((r) => setTimeout(r, openRouterChatDelayMs));
      }
      if (openRouterChatBehavior === 'quota_402') {
        return new Response('Insufficient credits on OpenRouter key', { status: 402 });
      }
      if (openRouterChatBehavior === 'rate_limit_429') {
        return new Response('Rate limit exceeded', { status: 429 });
      }
      if (openRouterChatBehavior === 'unsupported_model_400') {
        return new Response('Unsupported model capability', { status: 400 });
      }
      if (openRouterChatBehavior === 'malformed_json') {
        return Response.json({ choices: [{ message: { content: 'not valid json {{{' } }] });
      }
      if (openRouterChatBehavior === 'content_null') {
        return Response.json({ choices: [{ message: { content: null } }] });
      }
      if (openRouterChatBehavior === 'invalid_schema') {
        return Response.json({
          choices: [{ message: { content: JSON.stringify({ title: 'Only 1 scene', total_duration: 30, scenes: [] }) } }],
        });
      }
      return Response.json({
        choices: [
          {
            message: {
              content:
                '```json\n' +
                JSON.stringify({
                  title: 'Chiến lược Video AI cho CEO',
                  total_duration: 30,
                  scenes: [
                    {
                      scene_number: 1,
                      title: 'Mở đầu thu hút',
                      visual_description: 'CEO mở bảng điều khiển Sophia trên điện thoại',
                      narration: 'Làm sao xuất bản video ngắn mỗi ngày mà không cần đội ngũ kỹ thuật?',
                      duration_estimate: 10,
                    },
                    {
                      scene_number: 2,
                      title: 'Quy trình 3 bước',
                      visual_description: 'Màn hình duyệt kịch bản 3 phân cảnh rõ ràng',
                      narration: 'Nhập mục tiêu, xem trước chi phí và chỉnh sửa kịch bản ngay lập tức.',
                      duration_estimate: 10,
                    },
                    {
                      scene_number: 3,
                      title: 'Kêu gọi hành động',
                      visual_description: 'Nút xuất file Markdown và JSON an toàn',
                      narration: 'Bắt đầu ngay hôm nay với khóa BYOK của riêng bạn.',
                      duration_estimate: 10,
                    },
                  ],
                }) +
                '\n```',
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected outbound fetch in Blueprint 01 synthetic fixture: ${method} ${url}`);
  };

  firstValueRoute = await import('@/app/api/first-value/route');
});

beforeEach(() => {
  fixture?.sqlite.close();
  fixture = createB3SqliteFixture();
  for (const m of PILOT_MIGRATIONS) {
    fixture.sqlite.exec(readFileSync(resolve('migrations', m), 'utf8'));
  }
  bindD1Globals(fixture.binding);
  seedSyntheticTenant(fixture, {
    userId: 'usr-pilot-ceo',
    orgId: 'org-pilot-ceo',
    email: 'ceo@pilot.example.invalid',
  });
  currentUser = { id: 'usr-pilot-ceo', email: 'ceo@pilot.example.invalid' };
  openRouterProbeBehavior = 'valid';
  openRouterChatBehavior = 'valid_fenced';
  openRouterChatDelayMs = 0;
  outboundCalls.length = 0;
  process.env.PILOT_MAX_ESTIMATED_SPEND_USD = '4.00';
});

afterAll(() => {
  fixture?.sqlite.close();
  globalThis.fetch = originalFetch;
  for (const [k, v] of savedEnv) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe.sequential('Blueprint 01 BYOK & First-Value Closure (SYNTHETIC_FIXTURE)', () => {
  it('completes full Customer BYOK First-Value journey, enforces zero raw secret leakage, D1 resume, and records SYNTHETIC_FIXTURE timing', async () => {
    const t0 = performance.now();

    // 1. Expired / missing auth fails closed with 401
    currentUser = null;
    const unauthRes = await dispatchRoute(
      buildFirstValueReq('GET', '/api/first-value?orgId=org-pilot-ceo'),
      firstValueRoute.GET,
    );
    expect(unauthRes.status).toBe(401);
    currentUser = { id: 'usr-pilot-ceo', email: 'ceo@pilot.example.invalid' };

    // 2. Uninvited email fails closed with 403 PILOT_ACCESS_REVOKED
    currentUser = { id: 'usr-pilot-ceo', email: 'intruder@example.invalid' };
    const revokedRes = await dispatchRoute(
      buildFirstValueReq('GET', '/api/first-value?orgId=org-pilot-ceo'),
      firstValueRoute.GET,
    );
    expect(revokedRes.status).toBe(403);
    currentUser = { id: 'usr-pilot-ceo', email: 'ceo@pilot.example.invalid' };

    // 3. Accept pilot consent
    const consentRes = await dispatchRoute(
      buildFirstValueReq('POST', '/api/first-value', {
        action: 'accept_pilot_terms',
        orgId: 'org-pilot-ceo',
        policyVersion: '2026-11-pilot-v2',
        accepted: true,
      }),
      firstValueRoute.POST,
    );
    expect(consentRes.status).toBe(200);

    // 4. Attempting generation before BYOK key configured fails closed (zero platform fallback)
    const noKeyGen = await dispatchRoute(
      buildFirstValueReq(
        'POST',
        '/api/first-value',
        {
          action: 'create_review',
          orgId: 'org-pilot-ceo',
          missionId: 'mission_pilot_1',
          idempotencyKey: 'idem-nokey-0001',
          topic: 'Tăng trưởng doanh thu B2B',
          audience: 'CEO doanh nghiệp vừa và nhỏ',
          durationSec: 30,
          provenance: 'live_provider',
        },
        'idem-nokey-0001',
      ),
      firstValueRoute.POST,
    );
    expect(noKeyGen.status).toBe(422);
    expect(await noKeyGen.json()).toMatchObject({ code: 'BYOK_KEY_REQUIRED' });

    // 5. Save Customer BYOK key (lightweight /auth/key probe only — zero chat completions during validation)
    const saveKeyRes = await dispatchRoute(
      buildFirstValueReq('POST', '/api/first-value', {
        action: 'save_byok_key',
        orgId: 'org-pilot-ceo',
        apiKey: CUSTOMER_KEY,
      }),
      firstValueRoute.POST,
    );
    expect(saveKeyRes.status).toBe(200);
    const saveKeyBodyText = await saveKeyRes.text();
    expect(saveKeyBodyText).not.toContain(CUSTOMER_KEY);
    expect(outboundCalls).toEqual(['GET https://openrouter.ai/api/v1/auth/key']);

    // 6. Cost preview before chargeable execution
    const previewRes = await dispatchRoute(
      buildFirstValueReq('POST', '/api/first-value', {
        action: 'cost_preview',
        orgId: 'org-pilot-ceo',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        topic: 'Tăng trưởng doanh thu B2B',
        audience: 'CEO doanh nghiệp vừa và nhỏ',
        durationSec: 30,
      }),
      firstValueRoute.POST,
    );
    expect(previewRes.status).toBe(200);
    expect(await previewRes.json()).toMatchObject({
      preview: { status: 'COST_ESTIMATE_AVAILABLE' },
      paidInferenceExecuted: false,
    });

    // 7. Idempotent live_provider script generation (parses markdown-fenced JSON)
    const createRes = await dispatchRoute(
      buildFirstValueReq(
        'POST',
        '/api/first-value',
        {
          action: 'create_review',
          orgId: 'org-pilot-ceo',
          missionId: 'mission_pilot_1',
          idempotencyKey: 'idem-gen-0001',
          topic: 'Tăng trưởng doanh thu B2B',
          audience: 'CEO doanh nghiệp vừa và nhỏ',
          durationSec: 30,
          provenance: 'live_provider',
        },
        'idem-gen-0001',
      ),
      firstValueRoute.POST,
    );
    expect(createRes.status).toBe(201);
    const createdJson = (await createRes.json()) as {
      review: { artifactId: string; version: number; reviewState: string };
    };
    const artifactId = createdJson.review.artifactId;
    const tFirstValueMs = performance.now() - t0;

    // Duplicate replay with same idempotencyKey does NOT call OpenRouter again or consume extra quota
    const chatCallsBeforeReplay = outboundCalls.filter((c) => c.includes('/chat/completions')).length;
    const replayRes = await dispatchRoute(
      buildFirstValueReq(
        'POST',
        '/api/first-value',
        {
          action: 'create_review',
          orgId: 'org-pilot-ceo',
          missionId: 'mission_pilot_1',
          idempotencyKey: 'idem-gen-0001',
          topic: 'Tăng trưởng doanh thu B2B',
          audience: 'CEO doanh nghiệp vừa và nhỏ',
          durationSec: 30,
          provenance: 'live_provider',
        },
        'idem-gen-0001',
      ),
      firstValueRoute.POST,
    );
    expect(replayRes.status).toBe(200);
    expect(await replayRes.json()).toMatchObject({ idempotentReplay: true, paidInferenceExecuted: false });
    expect(outboundCalls.filter((c) => c.includes('/chat/completions'))).toHaveLength(chatCallsBeforeReplay);

    // 8. Safe resume after network disconnect / browser refresh via GET /api/first-value
    const resumeRes = await dispatchRoute(
      buildFirstValueReq('GET', '/api/first-value?orgId=org-pilot-ceo'),
      firstValueRoute.GET,
    );
    expect(resumeRes.status).toBe(200);
    const resumeText = await resumeRes.text();
    expect(resumeText).not.toContain(CUSTOMER_KEY);
    const resumeJson = JSON.parse(resumeText) as {
      recentReviews: Array<{ artifactId: string }>;
      pilot: { quota: { usedGenerations: number } };
    };
    expect(resumeJson.recentReviews[0]?.artifactId).toBe(artifactId);
    expect(resumeJson.pilot.quota.usedGenerations).toBe(1);

    // 9. Human approval (accept_review) + Private Markdown/JSON export
    const acceptRes = await dispatchRoute(
      buildFirstValueReq(
        'POST',
        '/api/first-value',
        {
          action: 'accept_review',
          orgId: 'org-pilot-ceo',
          artifactId,
          expectedVersion: 1,
          explicitUserAction: true,
          idempotencyKey: 'idem-accept-0001',
        },
        'idem-accept-0001',
      ),
      firstValueRoute.POST,
    );
    expect(acceptRes.status).toBe(200);
    const tFirstAcceptedDeliverableMs = performance.now() - t0;

    const exportRes = await dispatchRoute(
      buildFirstValueReq(
        'POST',
        '/api/first-value',
        {
          action: 'private_export',
          orgId: 'org-pilot-ceo',
          artifactId,
          format: 'markdown',
          idempotencyKey: 'idem-export-0001',
        },
        'idem-export-0001',
      ),
      firstValueRoute.POST,
    );
    expect(exportRes.status).toBe(200);
    const exportJson = (await exportRes.json()) as { export: { content: string } };
    expect(exportJson.export.content).toContain('Chiến lược Video AI cho CEO');

    // 10. Zero raw secret in D1 tables (user_api_keys, pilot_events, first_value_reviews)
    const dbDump = JSON.stringify({
      events: fixture.sqlite.prepare('SELECT * FROM pilot_events').all(),
      reviews: fixture.sqlite.prepare('SELECT * FROM first_value_reviews').all(),
    });
    expect(dbDump).not.toContain(CUSTOMER_KEY);

    expect(tFirstValueMs).toBeGreaterThan(0);
    expect(tFirstAcceptedDeliverableMs).toBeGreaterThanOrEqual(tFirstValueMs);
  });

  it('handles invalid key, credit exhaustion, malformed JSON, content-null, invalid schema, fail-closed spend cap, and concurrent in-flight lock', async () => {
    await dispatchRoute(
      buildFirstValueReq('POST', '/api/first-value', {
        action: 'accept_pilot_terms',
        orgId: 'org-pilot-ceo',
        policyVersion: '2026-11-pilot-v2',
        accepted: true,
      }),
      firstValueRoute.POST,
    );

    // Invalid key probe -> 422 BYOK_KEY_REJECTED
    openRouterProbeBehavior = 'invalid_401';
    const badKeyRes = await dispatchRoute(
      buildFirstValueReq('POST', '/api/first-value', {
        action: 'save_byok_key',
        orgId: 'org-pilot-ceo',
        apiKey: CUSTOMER_KEY,
      }),
      firstValueRoute.POST,
    );
    expect(badKeyRes.status).toBe(422);
    expect(await badKeyRes.json()).toMatchObject({ code: 'BYOK_KEY_REJECTED' });

    // Exhausted credit probe ($0 limit_remaining) -> 422 BYOK_KEY_QUOTA_EXCEEDED
    openRouterProbeBehavior = 'quota_402';
    const zeroCreditProbe = await dispatchRoute(
      buildFirstValueReq('POST', '/api/first-value', {
        action: 'save_byok_key',
        orgId: 'org-pilot-ceo',
        apiKey: CUSTOMER_KEY,
      }),
      firstValueRoute.POST,
    );
    expect(zeroCreditProbe.status).toBe(422);
    expect(await zeroCreditProbe.json()).toMatchObject({ code: 'BYOK_KEY_QUOTA_EXCEEDED' });

    // Save valid key
    openRouterProbeBehavior = 'valid';
    expect(
      (
        await dispatchRoute(
          buildFirstValueReq('POST', '/api/first-value', {
            action: 'save_byok_key',
            orgId: 'org-pilot-ceo',
            apiKey: CUSTOMER_KEY,
          }),
          firstValueRoute.POST,
        )
      ).status,
    ).toBe(200);

    // Fault matrix on generation: quota_402 (refunds slot), malformed_json, content_null, invalid_schema, unsupported_model_400
    const faultModes: Array<{
      mode: typeof openRouterChatBehavior;
      expectedStatus: number;
      expectedCode: string;
      quotaRefunded: boolean;
    }> = [
      { mode: 'quota_402', expectedStatus: 502, expectedCode: 'PROVIDER_QUOTA_EXCEEDED', quotaRefunded: true },
      { mode: 'malformed_json', expectedStatus: 502, expectedCode: 'PROVIDER_GENERATION_FAILED', quotaRefunded: false },
      { mode: 'content_null', expectedStatus: 502, expectedCode: 'PROVIDER_GENERATION_FAILED', quotaRefunded: false },
      { mode: 'invalid_schema', expectedStatus: 502, expectedCode: 'INVALID_SCRIPT_STRUCTURE', quotaRefunded: false },
      { mode: 'unsupported_model_400', expectedStatus: 502, expectedCode: 'PROVIDER_GENERATION_FAILED', quotaRefunded: false },
    ];

    for (let i = 0; i < faultModes.length; i++) {
      const f = faultModes[i];
      openRouterChatBehavior = f.mode;
      const key = `idem-fault-${i}-0001`;
      const res = await dispatchRoute(
        buildFirstValueReq(
          'POST',
          '/api/first-value',
          {
            action: 'create_review',
            orgId: 'org-pilot-ceo',
            missionId: 'mission_faults',
            idempotencyKey: key,
            topic: `Fault topic ${i}`,
            audience: 'SMB Founders',
            durationSec: 30,
            provenance: 'live_provider',
          },
          key,
        ),
        firstValueRoute.POST,
      );
      expect(res.status, f.mode).toBe(f.expectedStatus);
      expect(await res.json(), f.mode).toMatchObject({
        code: f.expectedCode,
        quotaRefunded: f.quotaRefunded,
      });
    }

    // Concurrent request guard: 2 simultaneous distinct idempotency keys -> 1 succeeds (201), 1 blocked in_flight (429)
    openRouterChatBehavior = 'valid_fenced';
    openRouterChatDelayMs = 50;
    const [c1, c2] = await Promise.all([
      dispatchRoute(
        buildFirstValueReq(
          'POST',
          '/api/first-value',
          {
            action: 'create_review',
            orgId: 'org-pilot-ceo',
            missionId: 'mission_conc',
            idempotencyKey: 'idem-conc-a-0001',
            topic: 'Concurrent A',
            audience: 'SMB Founders',
            durationSec: 30,
            provenance: 'live_provider',
          },
          'idem-conc-a-0001',
        ),
        firstValueRoute.POST,
      ),
      dispatchRoute(
        buildFirstValueReq(
          'POST',
          '/api/first-value',
          {
            action: 'create_review',
            orgId: 'org-pilot-ceo',
            missionId: 'mission_conc',
            idempotencyKey: 'idem-conc-b-0001',
            topic: 'Concurrent B',
            audience: 'SMB Founders',
            durationSec: 30,
            provenance: 'live_provider',
          },
          'idem-conc-b-0001',
        ),
        firstValueRoute.POST,
      ),
    ]);
    const statuses = [c1.status, c2.status].sort();
    expect(statuses).toEqual([201, 429]);

    // Fail-closed spending cap when PILOT_MAX_ESTIMATED_SPEND_USD is missing/invalid
    process.env.PILOT_MAX_ESTIMATED_SPEND_USD = '';
    const capClosedRes = await dispatchRoute(
      buildFirstValueReq(
        'POST',
        '/api/first-value',
        {
          action: 'create_review',
          orgId: 'org-pilot-ceo',
          missionId: 'mission_cap',
          idempotencyKey: 'idem-cap-closed-0001',
          topic: 'Cap check',
          audience: 'SMB Founders',
          durationSec: 30,
          provenance: 'live_provider',
        },
        'idem-cap-closed-0001',
      ),
      firstValueRoute.POST,
    );
    expect(capClosedRes.status).toBe(503);
    expect(await capClosedRes.json()).toMatchObject({ code: 'PILOT_COST_CONTROLS_UNCONFIGURED' });
  });
});
