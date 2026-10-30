/**
 * Component tests for the campaign approval queue section.
 *
 * Covers list/empty/error/retry states, per-status actions (approve, reject,
 * resume, revoke), reason capture, continuation notices, and action errors.
 * Imports through the barrel so the re-export lines are exercised.
 *
 * @module components/approval-queue/__tests__/campaign-queue-view.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { CampaignApprovalQueue } from '../index';
import type { CampaignApprovalItem } from '../campaign-queue-api';

const TEST_MESSAGES = {
  approvals: {
    approve: 'Approve',
    reject: 'Reject',
    reasonPlaceholder: 'Enter a reason (optional)',
    campaign: {
      title: 'Campaign approvals',
      description: 'CEO decisions for affiliate video campaigns.',
      loading: 'Loading campaign approvals…',
      loadFailed: 'Could not load campaign approvals',
      retry: 'Try again',
      emptyTitle: 'No campaign approvals',
      emptyDescription: 'Campaigns that need a CEO decision will appear here.',
      resume: 'Resume',
      revoke: 'Revoke',
      expires: 'Expires',
      reasonLabel: 'Reason',
      hashLabel: 'Payload hash',
      continuationPending: 'Approval granted, but execution could not resume automatically.',
      resumed: 'Execution resumed.',
      status: {
        pending_ceo: 'Pending CEO',
        approved: 'Approved',
        rejected: 'Rejected',
        revoked: 'Revoked',
        expired: 'Expired',
        invalidated_by_mutation: 'Invalidated',
        executed: 'Executed',
        aborted_by_kill_switch: 'Stopped',
      },
      fields: {
        niche: 'Niche',
        jurisdiction: 'Jurisdiction',
        budget: 'Render budget',
        target: 'Affiliate link',
      },
    },
  },
};

const PENDING_ITEM: CampaignApprovalItem = {
  id: 'app_1',
  campaignId: 'camp_1',
  niche: 'saas_global',
  jurisdiction: 'US',
  status: 'pending_ceo',
  approvalPayloadHash: 'abcdef0123456789abcdef0123456789',
  approvedBy: null,
  approvedAt: null,
  expiresAt: Date.now() + 86400000,
  revokedBy: null,
  revokedAt: null,
  executedAt: null,
  rejectionReason: null,
  createdAt: Date.now() - 3600000,
  payload: {
    scriptBody: 'Honest review of Acme SaaS for agencies and operators.',
    affiliateTargetUrl: 'https://sophia.ai/r/acme',
    jurisdiction: 'US',
    disclosureText: '#ad — affiliate link',
    maxRenderCostCents: 50,
  },
};

const APPROVED_ITEM: CampaignApprovalItem = {
  ...PENDING_ITEM,
  id: 'app_2',
  status: 'approved',
  approvedBy: 'ceo_1',
  approvedAt: Date.now() - 1000,
};

const REJECTED_ITEM: CampaignApprovalItem = {
  ...PENDING_ITEM,
  id: 'app_3',
  status: 'rejected',
  rejectionReason: 'Off-brand script',
};

function renderQueue() {
  return render(
    <NextIntlClientProvider locale="en" messages={TEST_MESSAGES}>
      <CampaignApprovalQueue workspaceId="ws_1" />
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

const listResponse = (approvals: CampaignApprovalItem[]) => () =>
  Response.json({ approvals, count: approvals.length, limit: 50, offset: 0 });

describe('CampaignApprovalQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders loading state, then campaign items with payload summary', async () => {
    let resolveList!: (value: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      resolveList = resolve;
    });
    mockFetchSequence([() => gate]);
    renderQueue();
    expect(screen.getByText('Loading campaign approvals…')).toBeDefined();

    resolveList(Response.json({ approvals: [PENDING_ITEM], count: 1, limit: 50, offset: 0 }));
    await waitFor(() => expect(screen.getByText('camp_1')).toBeDefined());
    expect(screen.getByText('Pending CEO')).toBeDefined();
    expect(screen.getByText('saas_global')).toBeDefined();
    expect(screen.getByText('https://sophia.ai/r/acme')).toBeDefined();
    expect(screen.getByText('#ad — affiliate link')).toBeDefined();
    expect(screen.getByText(/Payload hash/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDefined();
  });

  it('renders the empty state when there are no approvals', async () => {
    mockFetchSequence([listResponse([])]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('No campaign approvals')).toBeDefined());
    expect(
      screen.getByText('Campaigns that need a CEO decision will appear here.'),
    ).toBeDefined();
  });

  it('renders the error state with retry, and retry reloads', async () => {
    mockFetchSequence([
      () => Response.json({ error: 'boom' }, { status: 500 }),
      listResponse([PENDING_ITEM]),
    ]);
    renderQueue();
    await waitFor(() =>
      expect(screen.getByText('Could not load campaign approvals')).toBeDefined(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('camp_1')).toBeDefined());
  });

  it('approves a pending item with a reason and reloads the list', async () => {
    const seen: Array<{ url: string; init?: RequestInit }> = [];
    mockFetchSequence([
      listResponse([PENDING_ITEM]),
      (url, init) => {
        seen.push({ url, init });
        return Response.json({ status: 'approved', approvalId: 'app_1', continuation: 'sent' });
      },
      listResponse([{ ...PENDING_ITEM, status: 'approved' }]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('camp_1')).toBeDefined());

    const reason = document.getElementById('campaign-reason-app_1') as HTMLTextAreaElement;
    fireEvent.change(reason, { target: { value: 'Looks good' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(screen.getByText('Approved')).toBeDefined());
    expect(seen).toHaveLength(1);
    expect(seen[0]?.url).toBe('/api/campaign-approvals/app_1');
    expect(seen[0]?.init?.method).toBe('PATCH');
    expect(seen[0]?.init?.body).toContain('"action":"approve"');
    expect(seen[0]?.init?.body).toContain('Looks good');
  });

  it('shows a notice when approval is granted but continuation is pending', async () => {
    mockFetchSequence([
      listResponse([PENDING_ITEM]),
      () =>
        Response.json({
          status: 'approved',
          approvalId: 'app_1',
          continuation: 'not_sent',
          continuationCode: 'TERMS_UNVERIFIED',
        }),
      listResponse([{ ...PENDING_ITEM, status: 'approved' }]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('camp_1')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(
        screen.getByText('Approval granted, but execution could not resume automatically.'),
      ).toBeDefined(),
    );
  });

  it('rejects a pending item', async () => {
    mockFetchSequence([
      listResponse([PENDING_ITEM]),
      () => Response.json({ status: 'rejected', approvalId: 'app_1' }),
      listResponse([{ ...PENDING_ITEM, status: 'rejected', rejectionReason: 'Nope' }]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('camp_1')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(screen.getByText('Rejected')).toBeDefined());
  });

  it('resumes an approved item and shows the resumed notice', async () => {
    mockFetchSequence([
      listResponse([APPROVED_ITEM]),
      () => Response.json({ status: 'approved', approvalId: 'app_2', resumed: true }),
      listResponse([APPROVED_ITEM]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('Approved')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(screen.getByText('Execution resumed.')).toBeDefined());
  });

  it('revokes an approved item', async () => {
    mockFetchSequence([
      listResponse([APPROVED_ITEM]),
      () => Response.json({ status: 'revoked', approvalId: 'app_2' }),
      listResponse([{ ...APPROVED_ITEM, status: 'revoked' }]),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('Approved')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(screen.getByText('Revoked')).toBeDefined());
  });

  it('shows the rejection reason on terminal items without action buttons', async () => {
    mockFetchSequence([listResponse([REJECTED_ITEM])]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('Rejected')).toBeDefined());
    expect(screen.getByText(/Off-brand script/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('displays action errors without losing the list', async () => {
    mockFetchSequence([
      listResponse([PENDING_ITEM]),
      () => Response.json({ error: 'Only workspace owner or admin can resolve approvals' }, { status: 403 }),
    ]);
    renderQueue();
    await waitFor(() => expect(screen.getByText('camp_1')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() =>
      expect(
        screen.getByText('Only workspace owner or admin can resolve approvals'),
      ).toBeDefined(),
    );
    expect(screen.getByText('camp_1')).toBeDefined();
  });
});
