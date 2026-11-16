/**
 * Publish approval gate — labelled-fixture tests
 *
 * The gate sits between "the render finished" and "the world can see it", so the
 * property under test is that a public publish never proceeds on its own. The
 * second property is that a duplicate delivery or a cron replay for the same
 * media does not produce a second human decision or a second post.
 *
 * @module tree/publishing/approval/__tests__/publish-approval-gate
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  getPublishLedgerRecord: vi.fn(),
  claimPublishApprovalRequest: vi.fn(),
}));

vi.mock('../ledger-store', () => ({
  getPublishLedgerRecord: store.getPublishLedgerRecord,
  claimPublishApprovalRequest: store.claimPublishApprovalRequest,
}));

import {
  awaitPublishApproval,
  PUBLISH_APPROVAL_REQUESTED_EVENT,
  PUBLISH_APPROVAL_RESOLVED_EVENT,
  PUBLISH_APPROVAL_TIMEOUT_MS,
} from '../gate';
import type { PublishApprovalStep } from '../types';

/** A mock-backed step, so a test can inspect which step ids the gate used. */
function stepWith(waitForEvent: PublishApprovalStep['waitForEvent']) {
  const sendEvent = vi.fn().mockResolvedValue({ ids: ['evt_1'] });
  const run = vi.fn().mockImplementation(async (_id: string, fn: () => Promise<unknown>) => fn());
  const waited = vi.fn(waitForEvent);
  return {
    step: { run, waitForEvent: waited, sendEvent } as unknown as PublishApprovalStep & {
      sendEvent: typeof sendEvent;
      run: typeof run;
      waitForEvent: typeof waited;
    },
    sendEvent,
    run,
  };
}

const publicSubject = {
  tenantId: 'org_1',
  channelId: 'chan_1',
  platform: 'youtube',
  mediaRef: 'r2://bucket/clip-1.mp4',
  requestedPrivacy: 'public',
};

/** Injection point for the ledger's epoch-second clock, so nothing drifts. */
const NOW_SECONDS = 1_794_112_501;
const gatedSubject = { ...publicSubject, nowSeconds: () => NOW_SECONDS };

const approvedEvent = { data: { decision: 'approved', reviewerId: 'user_ceo' } };
const rejectedEvent = { data: { decision: 'rejected', reviewerId: 'user_ceo', comment: 'Not on brand' } };

/**
 * A resolution as the ledger holds it once a reviewer has answered. The gate
 * deliberately re-reads the ledger after the wake-up event instead of trusting
 * the payload, so a fixture that fires the event without writing this row is
 * asserting behaviour the gate is built to refuse.
 */
function ledgerRecordWith(decision: 'approved' | 'rejected') {
  return {
    idempotencyKey: 'key_1',
    tenantId: 'org_1',
    channelId: 'chan_1',
    platform: 'youtube',
    mediaRef: 'r2://bucket/clip-1.mp4',
    decision,
    reviewerId: 'user_ceo',
    createdAt: NOW_SECONDS,
    expiresAt: NOW_SECONDS + 86_400,
  };
}

/**
 * Simulates a reviewer answering *while the gate waits*: the row is absent on
 * the first read (so there is no prior decision) and present afterwards (so the
 * gate re-reads the decision it was just woken for). A store that already holds
 * the answer on the first read would short-circuit the gate and prove nothing
 * about the wait.
 */
function resolvesWithDuring(decision: 'approved' | 'rejected') {
  let reads = 0;
  store.getPublishLedgerRecord.mockImplementation(async () => {
    reads += 1;
    return reads === 1 ? null : ledgerRecordWith(decision);
  });
}

/** Removes the trailing attempt index so two runs' step ids can be compared. */
function stripAttempt(ids: string[]): string[] {
  return ids.map((id) => id.replace(/-\d+$/, ''));
}

describe('awaitPublishApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getPublishLedgerRecord.mockResolvedValue(null);
    store.claimPublishApprovalRequest.mockResolvedValue({ claimed: true, key: 'key_1' });
  });

  it('asks a human for a public publish and releases the upload once approved', async () => {
    resolvesWithDuring('approved');
    const { step, sendEvent } = stepWith(vi.fn().mockResolvedValue(approvedEvent));

    const result = await awaitPublishApproval(gatedSubject, step);

    expect(result.state.outcome).toBe('allowed');
    expect(result.decision).toBe('approved');
    expect(sendEvent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      name: PUBLISH_APPROVAL_REQUESTED_EVENT,
      data: expect.objectContaining({ platform: 'youtube', channelId: 'chan_1', mediaRef: 'r2://bucket/clip-1.mp4' }),
    }));
  });

  it('claims the request without a requester when the caller has no user id', async () => {
    resolvesWithDuring('approved');
    const { step } = stepWith(vi.fn().mockResolvedValue(approvedEvent));

    await awaitPublishApproval(gatedSubject, step);

    // The ledger column names a person, so an unnamed caller leaves it empty
    // rather than filled in with the tenant the publish belongs to.
    expect(store.claimPublishApprovalRequest).toHaveBeenCalledTimes(1);
    expect(store.claimPublishApprovalRequest.mock.calls[0][0]).toMatchObject({
      tenantId: 'org_1',
    });
    expect(store.claimPublishApprovalRequest.mock.calls[0][0].requesterId).toBeUndefined();
  });

  it('withholds the publish when the human rejects it', async () => {
    resolvesWithDuring('rejected');
    const { step } = stepWith(vi.fn().mockResolvedValue(rejectedEvent));

    const result = await awaitPublishApproval(gatedSubject, step);

    expect(result.state.outcome).toBe('blocked');
    expect(result.decision).toBe('rejected');
    if (result.state.outcome !== 'blocked') throw new Error('unreachable');
    expect(result.state.reasonVi.length).toBeGreaterThan(0);
  });

  it('withholds the publish when no decision arrives, rather than defaulting to approved', async () => {
    const { step } = stepWith(vi.fn().mockResolvedValue(null));

    const result = await awaitPublishApproval(gatedSubject, step);

    expect(result.state.outcome).toBe('blocked');
    expect(result.decision).toBe('expired');
  });

  it('waits at most 72 hours for a decision', async () => {
    resolvesWithDuring('approved');
    const { step } = stepWith(vi.fn().mockResolvedValue(approvedEvent));

    await awaitPublishApproval(gatedSubject, step);

    expect(step.waitForEvent).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      event: PUBLISH_APPROVAL_RESOLVED_EVENT,
      timeout: PUBLISH_APPROVAL_TIMEOUT_MS,
    }));
  });

  it('releases a publish already approved without asking a second time', async () => {
    store.getPublishLedgerRecord.mockResolvedValue(ledgerRecordWith('approved'));
    const { step, sendEvent } = stepWith(vi.fn());

    const result = await awaitPublishApproval(gatedSubject, step);

    expect(result.state.outcome).toBe('allowed');
    expect(sendEvent).not.toHaveBeenCalled();
    expect(step.waitForEvent).not.toHaveBeenCalled();
    expect(store.claimPublishApprovalRequest).not.toHaveBeenCalled();
  });

  it('re-joins the existing request instead of enqueueing a second human decision', async () => {
    store.claimPublishApprovalRequest.mockResolvedValue({ claimed: false, key: 'key_1' });
    resolvesWithDuring('approved');
    const { step, sendEvent } = stepWith(vi.fn().mockResolvedValue(approvedEvent));

    const result = await awaitPublishApproval(gatedSubject, step);

    expect(result.state.outcome).toBe('allowed');
    // The losing delivery must not emit its own request: one media, one decision.
    expect(sendEvent).not.toHaveBeenCalled();
    expect(step.waitForEvent).toHaveBeenCalledOnce();
  });

  it('blocks a losing delivery whose shared request was rejected', async () => {
    store.claimPublishApprovalRequest.mockResolvedValue({ claimed: false, key: 'key_1' });
    resolvesWithDuring('rejected');
    const { step } = stepWith(vi.fn().mockResolvedValue(rejectedEvent));

    const result = await awaitPublishApproval(gatedSubject, step);

    expect(result.state.outcome).toBe('blocked');
    expect(result.decision).toBe('rejected');
  });

  it('never asks a human about a private publish', async () => {
    const { step, sendEvent } = stepWith(vi.fn());

    const result = await awaitPublishApproval({ ...publicSubject, requestedPrivacy: 'private' }, step);

    expect(result.state.outcome).toBe('allowed');
    expect(sendEvent).not.toHaveBeenCalled();
    expect(store.getPublishLedgerRecord).not.toHaveBeenCalled();
  });

  it('keeps step ids distinct across retries so a retried delivery cannot reuse a memoized wait', async () => {
    const { step } = stepWith(vi.fn().mockResolvedValue(approvedEvent));

    resolvesWithDuring('approved');
    const firstRun = await awaitPublishApproval(gatedSubject, step);
    const firstIds = step.run.mock.calls.map((c) => String(c[0]));
    step.run.mockClear();

    // A fresh fixture per attempt, so the retry walks the same path the first
    // delivery did: no prior decision, then one written while it waits.
    resolvesWithDuring('approved');
    const secondRun = await awaitPublishApproval({ ...gatedSubject, attempt: 1 }, step);
    const secondIds = step.run.mock.calls.map((c) => String(c[0]));

    expect(firstRun.state.outcome).toBe('allowed');
    expect(secondRun.state.outcome).toBe('allowed');
    // The same sequence of steps, with the attempt index in every id. Without
    // that suffix a retry would reuse the memoized wait and skip the re-read.
    expect(stripAttempt(firstIds)).toEqual(stripAttempt(secondIds));
    expect(firstIds).not.toEqual(secondIds);
    expect(step.waitForEvent.mock.calls[0]?.[0]).not.toBe(step.waitForEvent.mock.calls[1]?.[0]);
  });
});
