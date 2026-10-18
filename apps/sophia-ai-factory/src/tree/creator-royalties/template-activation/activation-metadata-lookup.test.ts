import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { TemplateActivationInput } from '@/seed/types/creator-marketplace';
import {
  recordTemplateActivationSideEffects,
  resolveTemplateActivationMetadata,
} from './activation-metadata-lookup';

function makeInput(overrides: Partial<TemplateActivationInput> = {}): TemplateActivationInput {
  return {
    templateId: 'template-1',
    creatorId: 'creator-1',
    activatingUserId: 'user-2',
    tenantId: 'tenant-1',
    videoJobId: 'job-1',
    priceCents: undefined,
    ...overrides,
  } as TemplateActivationInput;
}

function makeDb(first: () => Promise<unknown>, run: () => Promise<unknown> = async () => ({ success: true })) {
  return {
    prepare: vi.fn(() => ({ bind: vi.fn(() => ({ first, run })) })),
  } as unknown as D1Database;
}

describe('template activation metadata helpers', () => {
  it('rejects templates that are not approved or active', async () => {
    const db = makeDb(async () => ({ creator_id: 'creator-2', price_cents: 1000, royalty_pct: 75, status: 'draft' }));
    await expect(resolveTemplateActivationMetadata(db, makeInput())).resolves.toMatchObject({
      ok: false,
      error: 'TEMPLATE_NOT_APPROVED',
    });
  });

  it('rejects self activation and resolves approved template data', async () => {
    const selfDb = makeDb(async () => ({ creator_id: 'user-2', price_cents: 1000, royalty_pct: 75, status: 'approved' }));
    await expect(resolveTemplateActivationMetadata(selfDb, makeInput())).resolves.toMatchObject({
      ok: false,
      error: 'SELF_TEMPLATE_ACTIVATION_PROHIBITED',
    });

    const db = makeDb(async () => ({ creator_id: 'creator-2', price_cents: 1000, royalty_pct: 75, status: 'active' }));
    await expect(resolveTemplateActivationMetadata(db, makeInput({ priceCents: 1250 }))).resolves.toEqual({
      ok: true,
      creatorId: 'creator-2',
      priceCents: 1250,
      royaltyPct: 75,
    });
  });

  it('uses input defaults when a template is absent or lookup fails', async () => {
    const absent = makeDb(async () => null);
    await expect(resolveTemplateActivationMetadata(absent, makeInput({ priceCents: 500 }))).resolves.toMatchObject({
      ok: true, creatorId: 'creator-1', priceCents: 500,
    });
    const failed = makeDb(async () => { throw new Error('missing table'); });
    await expect(resolveTemplateActivationMetadata(failed, makeInput({ priceCents: 500 }))).resolves.toMatchObject({
      ok: true, creatorId: 'creator-1', priceCents: 500,
    });
  });

  it('attempts both non-fatal counter updates and tolerates missing tables', async () => {
    const db = makeDb(async () => null);
    await expect(recordTemplateActivationSideEffects({ db, templateId: 'template-1', creatorId: 'creator-1', creatorCents: 70, nowMs: 123 })).resolves.toBeUndefined();
    expect(db.prepare).toHaveBeenCalledTimes(2);

    const failingDb = makeDb(async () => null, async () => { throw new Error('missing table'); });
    await expect(recordTemplateActivationSideEffects({ db: failingDb, templateId: 'template-1', creatorId: 'creator-1', creatorCents: 70, nowMs: 123 })).resolves.toBeUndefined();
  });
});
