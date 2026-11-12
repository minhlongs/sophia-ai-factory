/**
 * Requester identity — labelled-fixture tests
 *
 * The ledger's requester column names the person who asked for a publish, and a
 * reviewer compares it against their own id to see whether they are reviewing
 * their own work. A scheduled lane has no signed-in user, so what it leaves in
 * that column decides whether the comparison is meaningful. These tests pin the
 * normalization and, more importantly, that it happens where the row is written
 * so no caller can bypass it.
 *
 * @module tree/publishing/approval/__tests__/requester-identity
 */

import { describe, it, expect } from 'vitest';
import { toRequesterId, SYSTEM_REQUESTER_SENTINEL } from '../requester-identity';
import { claimPublishApprovalRequest } from '../ledger-store-mutations';
import type { D1Database } from '@/seed/db/client';

const SUBJECT = {
  tenantId: 'org_1',
  channelId: 'chan_1',
  platform: 'youtube',
  mediaRef: 'r2://bucket/clip-1.mp4',
  expiresAt: 1_794_200_000,
};

/** Captures the values the claim bound, so a test can read the requester slot. */
function fakeDb(): { db: D1Database; bound: unknown[][] } {
  const bound: unknown[][] = [];
  const db = {
    prepare: () => ({
      bind: (...values: unknown[]) => ({
        run: async () => {
          bound.push(values);
          return { meta: { changes: 1 } };
        },
      }),
      run: async () => ({ meta: { changes: 0 } }),
    }),
  };
  return { db: db as unknown as D1Database, bound };
}

/** The requester slot is the 6th bound value: key, tenant, channel, platform, media, requester. */
async function boundRequester(requesterId?: string): Promise<unknown> {
  const { db, bound } = fakeDb();
  await claimPublishApprovalRequest({ ...SUBJECT, requesterId }, db);
  return bound[bound.length - 1]?.[5];
}

describe('toRequesterId', () => {
  it('keeps a real user id', () => {
    expect(toRequesterId('user_ceo')).toBe('user_ceo');
  });

  it('drops the sentinel a scheduled lane sends in the user slot', () => {
    expect(toRequesterId(SYSTEM_REQUESTER_SENTINEL)).toBeUndefined();
  });

  it('treats an absent or blank id as no requester', () => {
    expect(toRequesterId(undefined)).toBeUndefined();
    expect(toRequesterId(null)).toBeUndefined();
    expect(toRequesterId('   ')).toBeUndefined();
  });

  it('does not confuse the sentinel with a user id that merely contains it', () => {
    expect(toRequesterId('system_admin')).toBe('system_admin');
  });
});

describe('claimPublishApprovalRequest requester column', () => {
  it('writes no requester when the lane has no signed-in user', async () => {
    // The column has to stay empty: a null there reads back as `undefined` and
    // the reviewer is told the decision is unattributed, which is the truth.
    expect(await boundRequester(undefined)).toBeNull();
  });

  it('writes no requester when a scheduled lane forwards its sentinel', async () => {
    expect(await boundRequester(SYSTEM_REQUESTER_SENTINEL)).toBeNull();
  });

  it('writes the user id when a person triggered the publish', async () => {
    expect(await boundRequester('user_ceo')).toBe('user_ceo');
  });
});
