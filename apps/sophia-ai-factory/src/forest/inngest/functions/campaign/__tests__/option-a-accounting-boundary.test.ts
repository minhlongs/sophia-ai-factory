// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createSqliteFixture } from '../../../../../../tests/revenue-journey/sqlite-fixture';
import { D1Client } from '@/seed/db/client-rpc';
import type { CampaignCreatedEventData } from '../types';

const seams = vi.hoisted(() => ({
  client: undefined as D1Client | undefined,
  queue: vi.fn(), provider: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => seams.client,
  getD1: () => seams.client?.unwrap(), getD1Safe: () => seams.client?.unwrap(),
}));
vi.mock('@/seed/inngest/client', () => ({ inngest: {
  send: seams.queue,
  createFunction: (_config: unknown, _trigger: unknown, handler: unknown) => handler,
} }));
// Authentication is a boundary input; campaign persistence and accounting remain real.
vi.mock('@/app/actions/campaigns-guard-helpers', () => ({
  authorizeCampaignCreation: async () => ({ userId: 'user-a', orgId: 'org-a', tier: 'BASIC' }),
  checkMultiChannelAccess: async () => true,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: async () => ({ status: 'FOUND', key: 'offline-test-key' }),
}));
vi.mock('@/tree/byok/resolve-user-api-key', () => ({ resolveUserApiKey: async () => null }));
vi.mock('@/forest/ab/variant-generator', () => ({
  generateVariants: async () => { throw new Error('Optional external AB transport unavailable'); },
}));
vi.mock('@/seed/inference/openrouter-client', () => ({ resilientChatCompletion: seams.provider }));
vi.mock('@/tree/telegram/user-notifier', () => ({ notifyUserByTelegram: vi.fn() }));

import { createCampaign } from '@/app/actions/campaigns';
import { generateCampaign } from '../campaign-function';

type Handler = (context: {
  event: { data: CampaignCreatedEventData };
  step: { run: <T>(name: string, work: () => Promise<T>) => Promise<T> };
}) => Promise<unknown>;
const handler = generateCampaign as unknown as Handler;
let fixture: ReturnType<typeof createSqliteFixture>;
const script = {
  title: 'Private text delivery',
  scenes: [{ scene_number: 1, visual_description: 'A desk', narration: 'A practical introduction.', duration_estimate: 10 }],
  total_duration: 10,
};
function accounting() {
  const row = (sql: string) => fixture.sqlite.prepare(sql).all();
  return {
    wallet: row('SELECT * FROM user_mcu_balance ORDER BY user_id'),
    grants: row('SELECT * FROM manual_pilot_credit_grants ORDER BY order_id'),
    debits: row('SELECT * FROM manual_pilot_credit_debits'),
    allocations: row('SELECT * FROM manual_pilot_credit_allocations'),
    ledger: row('SELECT * FROM mcu_transactions'),
  };
}
function campaign(id: string) {
  return fixture.sqlite.prepare('SELECT status,progress,script_content,error_message FROM campaigns WHERE id=?').get(id) as
    { status: string; progress: number; script_content: string | null; error_message: string | null } | undefined;
}
async function create() {
  const form = new FormData();
  form.set('title', 'Private pilot script'); form.set('topic', 'Offline accounting');
  form.set('audience', 'Founders'); form.set('platforms', 'youtube');
  return createCampaign(form);
}
async function deliver(campaignId: string) {
  return handler({
    event: { data: { campaignId, userId: 'user-a', topic: 'Offline accounting', audience: 'Founders', tier: 'BASIC', deliveryMode: 'text_only' } },
    step: { run: async <T>(_name: string, work: () => Promise<T>) => work() },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_MOCK_AI_SERVICES', 'false');
  fixture = createSqliteFixture();
  for (const migration of ['0140_create_campaign_checkpoints', '0018-campaigns', '0119-campaigns-org-id', '0021-affiliate-offers-selected', '0052-missions-engine', '0506_manual_pilot_settlement_ledger', '0507_manual_pilot_financial_state']) {
    fixture.sqlite.exec(readFileSync(`migrations/${migration}.sql`, 'utf8'));
  }
  fixture.sqlite.exec(`
    INSERT INTO users(id,email) VALUES('user-a','offline@example.invalid');
    INSERT INTO organizations(id,name) VALUES('org-a','Offline organization');
    INSERT INTO org_members(org_id,user_id) VALUES('org-a','user-a');
    INSERT INTO user_mcu_balance(user_id,credits_remaining,credits_total_purchased) VALUES('user-a',200,200);
    INSERT INTO manual_pilot_settlements(id,order_id,user_id,org_id,expected_amount_vnd,transfer_reference,status)
      VALUES('order','order','user-a','org-a',1990000,'offline','activated');
    INSERT INTO manual_pilot_financial_state(order_id,org_id,state,updated_at) VALUES('order','org-a','ACTIVE_14D','2026-01-01');
    INSERT INTO manual_pilot_credit_grants(order_id,user_id,org_id,granted,expires_at) VALUES('order','user-a','org-a',500,'2200-01-01');
    INSERT INTO manual_pilot_entitlements(order_id,user_id,org_id,starts_at,ends_at) VALUES('order','user-a','org-a','2000-01-01','2200-01-01');
  `);
  // Fixture implements the D1 operations used by the production query adapter.
  seams.client = new D1Client(fixture.binding as unknown as D1Database);
  seams.queue.mockResolvedValue({ ids: ['offline-event'] });
  seams.provider.mockResolvedValue(JSON.stringify(script));
});
afterEach(() => { fixture.sqlite.close(); vi.unstubAllEnvs(); });

describe('Option A actual campaign accounting boundary (current uncharged behavior, not approved free policy)', () => {
  it('persists dispatch failures and leaves all credit accounting unchanged on retries', async () => {
    const before = accounting();
    seams.queue.mockRejectedValue(new Error('Offline queue rejection'));
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await create();
      expect(result.success).toBe(false);
      expect(result.campaignId).toEqual(expect.any(String));
      expect(campaign(result.campaignId!)).toMatchObject({ status: 'failed', progress: 0 });
      expect(accounting()).toEqual(before);
    }
  });

  it.each(['provider rejection', 'invalid output'])('persists %s without debit on delivery retries', async (failure) => {
    const before = accounting();
    const created = await create();
    expect(created.success).toBe(true);
    if (failure === 'provider rejection') seams.provider.mockRejectedValue(new Error('Offline provider rejected request'));
    else seams.provider.mockResolvedValue('{"title":"Invalid","scenes":[]}');
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(deliver(created.campaignId!)).rejects.toThrow();
      expect(campaign(created.campaignId!)).toMatchObject({ status: 'failed' });
      expect(accounting()).toEqual(before);
    }
    expect(seams.provider).toHaveBeenCalledTimes(2);
  });

  it('durably completes text and skips duplicate delivery with no credit consumption', async () => {
    const before = accounting();
    const created = await create();
    expect(created.success).toBe(true);
    await deliver(created.campaignId!);
    const persisted = campaign(created.campaignId!);
    expect(persisted).toMatchObject({ status: 'completed', progress: 100 });
    expect(JSON.parse(String(persisted?.script_content))).toEqual(script);
    expect(await deliver(created.campaignId!)).toMatchObject({ skipped: true });
    expect(seams.provider).toHaveBeenCalledOnce();
    expect(accounting()).toEqual(before);
    expect(before.debits).toEqual([]); expect(before.allocations).toEqual([]); expect(before.ledger).toEqual([]);
  });
});
