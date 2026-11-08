/**
 * Component tests for the public-publish ledger approval queue.
 * Covers list/empty/error states, approve/reject decisions with reason capture,
 * CSRF header echoing, self-approval notices, action errors, and fast-poll burst.
 * @module components/approval-queue/__tests__/publish-queue-view.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { PublishLedgerApprovalQueue } from '../index';
import type { PublishApprovalItem } from '../publish-queue-api';

const TEST_MESSAGES = {
  approvals: {
    approve: 'Approve', reject: 'Reject', reason: 'Reason', reasonPlaceholder: 'Enter a reason (optional)',
    publish: {
      title: 'Publish approvals', description: 'Videos waiting for your decision before they go public.',
      pendingBadge: 'Waiting for you', pendingCount: 'waiting', unknownPlatform: 'Unknown channel',
      channelLabel: 'Channel', mediaLabel: 'Video to publish', requestedAt: 'Requested at',
      expiresAt: 'Expires at', approvePublish: 'Approve & publish', rejectPublish: 'Reject',
      refresh: 'Refresh', loadError: 'Could not load publish approvals',
      actionError: 'Could not record your decision. Please try again.',
      errorLoading: 'We could not load the publish list', tryAgain: 'Try again',
      emptyTitle: 'No videos waiting to be published', emptyDescription: 'Finished videos will appear here.',
      approvedNotice: 'Approved. The video is being published now.',
      rejectedNotice: 'Rejected. The video will not be published.',
      selfApprovedNotice: 'Approved. Note: you approved content you created yourself.',
    },
  },
};

const PENDING_ITEM: PublishApprovalItem = {
  id: 'pub_ledger_key_1', tenantId: 'org_1', channelId: 'yt_channel_primary', platform: 'youtube',
  mediaRef: 'https://cdn.example.com/tenants/org_1/videos/mission_1/final.mp4',
  createdAt: Math.floor(Date.now() / 1000) - 3600, expiresAt: Math.floor(Date.now() / 1000) + 86400,
};

function renderQueue() {
  return render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <PublishLedgerApprovalQueue workspaceId="org_1" />
    </NextIntlClientProvider>,
  );
}

function mockFetchSequence(
  impls: Array<(url: string, init?: RequestInit) => Response | Promise<Response>>,
): void {
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const impl = impls[Math.min(calls, impls.length - 1)];
      calls += 1;
      if (!impl) throw new Error('unexpected fetch call');
      return impl(url, init);
    }),
  );
}

const listResponse = (approvals: PublishApprovalItem[]) => () =>
  Response.json({ approvals, count: approvals.length, limit: 50, workspaces: 1 });

describe('PublishLedgerApprovalQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = 'csrf-token=test_csrf_token_123';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders pending publishes and filters by workspaceId when supplied', async () => {
    const otherTenant: PublishApprovalItem = { ...PENDING_ITEM, id: 'pub_other', tenantId: 'org_2', channelId: 'other_ch' };
    mockFetchSequence([listResponse([PENDING_ITEM, otherTenant])]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('yt_channel_primary')).toBeDefined());
    expect(screen.queryByText('other_ch')).toBeNull();
    expect(screen.getByText('youtube')).toBeDefined();
    expect(screen.getByText('Waiting for you')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve & publish' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined();
  });

  it('requests the pending list from /api/publish-approvals and renders empty state', async () => {
    const urls: string[] = [];
    mockFetchSequence([
      (url) => {
        urls.push(String(url));
        return Response.json({ approvals: [], count: 0, limit: 50, workspaces: 1 });
      },
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('No videos waiting to be published')).toBeDefined());
    expect(urls[0]?.startsWith('/api/publish-approvals?')).toBe(true);
    expect(urls[0]).toContain('limit=50');
    expect(screen.getByText('Finished videos will appear here.')).toBeDefined();
  });

  it('renders the error state with retry, and retry reloads', async () => {
    mockFetchSequence([
      () => Response.json({ error: 'Failed to list publish approvals' }, { status: 500 }),
      listResponse([PENDING_ITEM]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('Failed to list publish approvals')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('yt_channel_primary')).toBeDefined());
  });

  it('approves a pending publish with reason, echoes x-csrf-token, and reloads', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    mockFetchSequence([
      listResponse([PENDING_ITEM]),
      (url, init) => {
        seen.push({ url, init });
        return Response.json({ resolved: true, decision: 'approved', selfApproval: false });
      },
      listResponse([]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('yt_channel_primary')).toBeDefined());

    const reason = document.getElementById('publish-reason-pub_ledger_key_1') as HTMLTextAreaElement;
    fireEvent.change(reason, { target: { value: 'Offer verified' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve & publish' }));

    await waitFor(() => expect(screen.getByText(/Approved\. The video is being published now\./)).toBeDefined());
    expect(seen[0]?.url).toBe('/api/publish-approvals/pub_ledger_key_1');
    expect(seen[0]?.init?.method).toBe('PATCH');
    expect((seen[0]?.init?.headers as Record<string, string>)?.['x-csrf-token']).toBe('test_csrf_token_123');
    expect(seen[0]?.init?.body).toContain('"approved":true');
    expect(seen[0]?.init?.body).toContain('Offer verified');
  });

  it('rejects a pending publish with reason and omits empty comments on approve', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    mockFetchSequence([
      listResponse([PENDING_ITEM]),
      (url, init) => {
        seen.push({ url, init });
        return Response.json({ resolved: true, decision: 'rejected', selfApproval: false });
      },
      listResponse([PENDING_ITEM]),
      (url, init) => {
        seen.push({ url, init });
        return Response.json({ resolved: true, decision: 'approved', selfApproval: true });
      },
      listResponse([]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('yt_channel_primary')).toBeDefined());

    const reason = document.getElementById('publish-reason-pub_ledger_key_1') as HTMLTextAreaElement;
    fireEvent.change(reason, { target: { value: 'Wrong video' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.getByText(/Rejected\. The video will not be published\./)).toBeDefined());
    expect(seen[0]?.init?.body).toContain('"approved":false');

    fireEvent.change(reason, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve & publish' }));
    await waitFor(() =>
      expect(screen.getByText('Approved. Note: you approved content you created yourself.')).toBeDefined(),
    );
    expect(seen[1]?.init?.body).toBe(JSON.stringify({ approved: true }));
  });

  it('surfaces a 403 without losing the list and runs fast-poll burst', async () => {
    vi.useFakeTimers();
    try {
      let callCount = 0;
      const fetchSpy = vi.fn(async () => {
        callCount += 1;
        if (callCount === 4) {
          return Response.json({ message: 'Only workspace owner or admin can resolve publish approvals' }, { status: 403 });
        }
        return Response.json({ approvals: [PENDING_ITEM], count: 1 });
      });
      vi.stubGlobal('fetch', fetchSpy);

      let unmount!: () => void;
      await act(async () => { unmount = renderQueue().unmount; await vi.advanceTimersByTimeAsync(10); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
      await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
      expect(fetchSpy).toHaveBeenCalledTimes(3);

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Approve & publish' }));
        await vi.advanceTimersByTimeAsync(10);
      });
      expect(screen.getByText('Only workspace owner or admin can resolve publish approvals')).toBeDefined();
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
