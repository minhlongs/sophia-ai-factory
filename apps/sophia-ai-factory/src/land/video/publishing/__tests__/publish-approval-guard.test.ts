/**
 * Publish approval guard — attribution tests
 *
 * The ledger records who asked for a publish so a reviewer can see whether they
 * are approving their own work. Only a real user id answers that question; a
 * workspace id stands for a tenant, not a person, and a comparison against it
 * either invents a self-approval or hides a genuine one. These tests pin the
 * value the guard hands to the gate, independent of what the gate does with it.
 *
 * @module land/video/publishing/__tests__/publish-approval-guard
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const deps = vi.hoisted(() => ({
  awaitPublishApproval: vi.fn(),
  resolveVideoUrlOrFail: vi.fn(),
  assertSafeVideoUrl: vi.fn(),
}));

// Only the gate is stubbed; the requester rule under test is the real one, so
// the guard is exercised through the same helper every other lane uses.
vi.mock('@/tree/publishing/approval', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/tree/publishing/approval')>()),
  awaitPublishApproval: deps.awaitPublishApproval,
}));

vi.mock('../publish-url-utils', () => ({
  resolveVideoUrlOrFail: deps.resolveVideoUrlOrFail,
  assertSafeVideoUrl: deps.assertSafeVideoUrl,
  sanitizeError: (message: string) => message,
}));

import { runPublishApprovalGate } from '../publish-approval-guard';
import type { PublishingJob } from '@/seed/types';
import type { Step, StepEventTools } from '../publish-types';

const VIDEO_URL = 'https://fixtures.r2.dev/clip-1.mp4';

function fixtureJob(): PublishingJob {
  return {
    id: 'job_1',
    tenant_id: 'ws_1',
    video_id: 'vid_1',
    channel_id: 'chan_1',
    provider: 'youtube',
    status: 'scheduled',
    caption: 'Fixture caption',
    hashtags_json: null,
    title: 'Fixture title',
    product_link: null,
    privacy_status: 'public',
    scheduled_at: null,
    retry_count: 0,
    created_at: 1_760_000_000,
    updated_at: 1_760_000_000,
  };
}

/** Minimal stand-in for the step runtime and its event tools. */
function runtime(): { step: Step; eventTools: StepEventTools } {
  const run = vi.fn(async (_id: string, fn: () => Promise<unknown>) => fn());
  return {
    step: { sleep: vi.fn(async () => undefined), run } as unknown as Step,
    eventTools: { run, sendEvent: vi.fn(), waitForEvent: vi.fn() } as unknown as StepEventTools,
  };
}

function gateArgs(requesterId?: string) {
  const db = { from: () => ({ update: () => ({ eq: async () => undefined }) }) };
  const { step, eventTools } = runtime();
  return {
    db: db as unknown as Parameters<typeof runPublishApprovalGate>[0]['db'],
    jobId: 'job_1',
    job: fixtureJob(),
    tenantId: 'ws_1',
    requesterId,
    step,
    eventTools,
  };
}

/** The subject object the guard handed to the approval gate. */
function gateSubject(): { requesterId?: string; tenantId: string } {
  return deps.awaitPublishApproval.mock.calls[0][0] as { requesterId?: string; tenantId: string };
}

describe('runPublishApprovalGate attribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deps.resolveVideoUrlOrFail.mockResolvedValue(VIDEO_URL);
    deps.awaitPublishApproval.mockResolvedValue({ state: { outcome: 'allowed' }, decision: 'approved' });
  });

  it('records no requester when the caller has no user id', async () => {
    const outcome = await runPublishApprovalGate(gateArgs());

    expect(outcome).toEqual({ kind: 'proceed', videoUrl: VIDEO_URL });
    // A workspace id is not a person, so it must not be offered as one.
    expect(gateSubject().requesterId).toBeUndefined();
    expect(gateSubject().tenantId).toBe('ws_1');
  });

  it('records the real user id when the caller has one', async () => {
    await runPublishApprovalGate(gateArgs('user_ceo'));

    expect(gateSubject().requesterId).toBe('user_ceo');
  });

  it('records no requester when a scheduled lane passes the system sentinel', async () => {
    // Crons and scheduled dispatch have no signed-in user and send `'system'`.
    // It is a placeholder, not a person, so it is not offered as a requester.
    await runPublishApprovalGate(gateArgs('system'));

    expect(gateSubject().requesterId).toBeUndefined();
  });
});
