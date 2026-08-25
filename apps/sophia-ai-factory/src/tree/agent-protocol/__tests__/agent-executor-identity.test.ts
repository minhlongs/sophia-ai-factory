/**
 * AgentExecutor identity-block tests.
 *
 * Pins the identity-first prompting contract (Constitution §6):
 *  - context.creativeIdentity present → messages[0] is a 'system' message
 *    containing the condensed voice/tone/beliefs/forbidden-pattern fields.
 *  - context.creativeIdentity absent → NO extra message; legacy two-message
 *    shape preserved byte-for-byte ([role-system, user]).
 *
 * Real executeAgent on the D1 shim; stubs only the provider response.
 *
 * @module tree/agent-protocol/__tests__/agent-executor-identity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1, SCHEMA, mockGetD1 } from '@/__tests__/integration/shared-d1-shim';
import type { AgentDefinition, CreativeIdentity } from '@/seed/types/creative-domain';
import type { ChatMessage } from '@/seed/ai/provider-interface';
import type { ProviderRegistry } from '@/seed/ai/provider-registry';

const req = createRequire(import.meta.url);
type SqliteStatement = {
  get(...p: unknown[]): unknown;
  all(...p: unknown[]): unknown[];
  run(...p: unknown[]): { lastInsertRowid: bigint; changes: number };
};
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (p: string) => { exec(s: string): void; prepare(s: string): SqliteStatement };
};

const { getD1 } = await import('@/seed/db/client');
vi.mock('@/seed/db/client', () => ({ getD1: vi.fn() }));

import { buildIdentityBlock, executeAgent } from '@/tree/agent-protocol/agent-executor';

beforeEach(() => {
  vi.mocked(getD1).mockReset();
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const AGENT_ROLE = 'identity test copywriter';

let capturedMessages: ChatMessage[] = [];

function makeProvider() {
  return {
    id: 'openrouter',
    healthy: true,
    async chat(messages: ChatMessage[], _opts: unknown) {
      capturedMessages = messages;
      return {
        content: 'output',
        model: 'openrouter',
        provider: 'openrouter',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        latencyMs: 5,
      };
    },
  };
}

function makeRegistry() {
  const p = makeProvider();
  return {
    getHealthy: () => [{ id: 'openrouter' as const, provider: p, health: { status: 'healthy' } }],
  } as unknown as ProviderRegistry;
}

function makeDefinition(): AgentDefinition {
  return {
    id: 'ag_identity',
    name: 'Identity Test Agent',
    role: AGENT_ROLE,
    capabilities: ['text'],
    permissions: [
      { tool: 'read_mission', scopes: ['read'], maxCostCents: 0, requiresApproval: false },
    ],
    defaultAutonomy: 3 as 0 | 1 | 2 | 3 | 4,
    maxRetries: 1,
    timeoutMs: 1000,
    modelPolicy: { capability: 'text' },
  } as AgentDefinition;
}

function makeIdentity(): CreativeIdentity {
  return {
    id: 'ci_1',
    workspaceId: 'ws_identity',
    voiceDescription: 'warm storyteller with dry humor',
    tone: 'warm',
    formality: 0.4,
    energy: 0.7,
    beliefs: ['story beats polish', 'audience first'],
    positioning: 'premium calm tech',
    targetAudience: 'solo founders',
    forbiddenPatterns: ['guru speak', 'hustle bro'],
    requiredDisclosures: ['affiliate link notice'],
    preferredFormats: [],
    referenceWorks: [],
    version: 1,
    isActive: true,
    createdAt: 100,
    updatedAt: 100,
    updatedBy: 'user_1',
  };
}

function makeContext(identity?: CreativeIdentity) {
  return {
    workspaceId: 'ws_identity',
    creativeIdentity: identity,
    memory: [] as never[],
    autonomyLevel: 0 as 0 | 1 | 2 | 3 | 4,
    correlationId: 'corr_identity_1',
    budgetRemainingCents: 1000,
    approvedActionIds: [],
  };
}

async function setupAutonomy() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  const d1 = makeD1(db);
  mockGetD1(d1);
  const insert =
    'INSERT INTO autonomy_configs (id, workspace_id, agent_type, level, overrides_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)';
  await d1
    .prepare(insert)
    .bind(
      'aut_ws_global', 'ws_identity', 'global', 4, '{}', 100, 100,
      'aut_ws_ag', 'ws_identity', 'ag_identity', 4, '{}', 100, 100,
    )
    .run();
}

describe('executeAgent identity block', () => {
  beforeEach(() => {
    capturedMessages = [];
  });

  it('prepends a system identity message when creativeIdentity present', async () => {
    await setupAutonomy();
    const result = await executeAgent(makeDefinition(), makeContext(makeIdentity()), makeRegistry());
    expect(result.ok).toBe(true);

    expect(capturedMessages.length).toBe(3);
    const first = capturedMessages[0];
    expect(first.role).toBe('system');
    expect(first.content).toContain('CREATIVE IDENTITY');
    expect(first.content).toContain('warm storyteller with dry humor');
    expect(first.content).toContain('Tone: warm');
    expect(first.content).toContain('Beliefs:');
    expect(first.content).toContain('story beats polish');
    expect(first.content).toContain('Forbidden patterns (NEVER use)');
    expect(first.content).toContain('guru speak');
    // The agent role system message follows the identity block.
    expect(capturedMessages[1]).toEqual({ role: 'system', content: AGENT_ROLE });
  });

  it('adds no extra message when creativeIdentity undefined', async () => {
    await setupAutonomy();
    const result = await executeAgent(makeDefinition(), makeContext(), makeRegistry());
    expect(result.ok).toBe(true);

    expect(capturedMessages).toEqual([
      { role: 'system', content: AGENT_ROLE },
      { role: 'user', content: '[]' },
    ]);
  });

  it('buildIdentityBlock includes required disclosures when set', () => {
    const block = buildIdentityBlock(makeIdentity());
    expect(block).toContain('affiliate link notice');
    expect(block).toContain('MUST include');
  });

  it('buildIdentityBlock omits empty optional sections', () => {
    const base = makeIdentity();
    const minimal = { ...base, beliefs: [], positioning: '', targetAudience: '', requiredDisclosures: [], forbiddenPatterns: [] };
    const block = buildIdentityBlock(minimal);
    expect(block).not.toContain('Beliefs:');
    expect(block).not.toContain('Positioning:');
    expect(block).not.toContain('Forbidden patterns');
    expect(block).toContain('- Voice: warm storyteller with dry humor');
  });
});
