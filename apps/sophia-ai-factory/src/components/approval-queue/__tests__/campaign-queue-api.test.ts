/**
 * Unit tests for the campaign approval queue API client.
 *
 * @module components/approval-queue/__tests__/campaign-queue-api.test
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchCampaignApprovals,
  submitCampaignApprovalAction,
} from '../campaign-queue-api';

describe('campaign-queue-api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the workspace list', async () => {
    const approvals = [{ id: 'app_1', status: 'pending_ceo' }];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ approvals }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchCampaignApprovals('ws_1');
    expect(result).toEqual(approvals);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/api/campaign-approvals?');
    expect(url).toContain('workspaceId=ws_1');
  });

  it('throws the server error when listing fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Forbidden' }, { status: 403 })));
    await expect(fetchCampaignApprovals('ws_1')).rejects.toThrow('Forbidden');
  });

  it('throws HTTP status when listing fails without a JSON error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
    await expect(fetchCampaignApprovals('ws_1')).rejects.toThrow('HTTP 502');
  });

  it('submits actions and returns continuation metadata', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({ status: 'approved', continuation: 'sent', resumed: false }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await submitCampaignApprovalAction('app_1', 'approve', 'ok');
    expect(result).toEqual({ status: 'approved', continuation: 'sent', resumed: false });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/campaign-approvals/app_1');
  });

  it('throws server error or details when the action fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Conflict' }, { status: 409 })),
    );
    await expect(submitCampaignApprovalAction('app_1', 'approve')).rejects.toThrow('Conflict');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ details: 'state mismatch' }, { status: 409 })),
    );
    await expect(submitCampaignApprovalAction('app_1', 'approve')).rejects.toThrow('state mismatch');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    await expect(submitCampaignApprovalAction('app_1', 'approve')).rejects.toThrow('HTTP 500');
  });
});
