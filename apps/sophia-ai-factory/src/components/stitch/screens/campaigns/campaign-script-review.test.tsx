import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CampaignScriptReview } from './campaign-script-review';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('private campaign script review', () => {
  it('loads persisted assets and exposes private downloads and explicit local review', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ script: { title: 'Saved draft' } }) });
    render(<CampaignScriptReview campaignId="camp-1" />);
    fireEvent.click(screen.getByRole('button', { name: /View and review/ }));
    await screen.findByRole('textbox', { name: /Saved script/ });
    expect(fetchMock).toHaveBeenCalledWith('/api/campaigns/camp-1/export', { cache: 'no-store' });
    expect(screen.getByRole('link', { name: /Download Markdown/ }).getAttribute('href'))
      .toBe('/api/campaigns/camp-1/export?format=markdown');
    expect(screen.getByRole('checkbox').getAttribute('checked')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox'));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/on-screen only, not saved/)).toBeTruthy();
  });

  it('surfaces retrieval failure and allows retry', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    render(<CampaignScriptReview campaignId="camp-1" />);
    fireEvent.click(screen.getByRole('button', { name: /View and review/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Please retry'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
