import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CampaignCardDetails } from './campaign-card-details';
import type { Campaign } from './campaigns-page-types';

const fetchMock = vi.fn();
const campaign: Campaign = {
  id: 'synthetic campaign/1', title: 'Synthetic draft', status: 'done', channel: 'Text',
  channels: [], thumbnail: null, metrics: { views: '0', revenue: '0', ctr: '0%' },
  progress: 100, progressLabel: 'Completed', lastPublished: 'Never',
  action: 'Review', actionLabel: 'viewDetails',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
});

describe('campaign card completed-script entry', () => {
  it('opens the real private viewer for a completed campaign and permits local review', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ script: { title: 'Synthetic saved draft' } }) });
    render(<CampaignCardDetails campaign={campaign} t={key => key} />);
    expect(screen.getByText('100%')).toBeTruthy();
    expect(screen.getByText('lastPublished Never')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /View and review script/ }));
    await screen.findByRole('textbox', { name: /Saved script/ });
    expect(fetchMock).toHaveBeenCalledWith('/api/campaigns/synthetic%20campaign%2F1/export', { cache: 'no-store' });
    expect(screen.getByRole('link', { name: /Download Markdown/ }).getAttribute('href'))
      .toBe('/api/campaigns/synthetic%20campaign%2F1/export?format=markdown');
    fireEvent.click(screen.getByRole('checkbox'));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/on-screen only, not saved/)).toBeTruthy();
  });

  it.each(['draft', 'live', 'paused'] as const)('does not expose completed-script review for %s', status => {
    render(<CampaignCardDetails campaign={{ ...campaign, status, progress: 0 }} t={key => key} />);
    expect(screen.queryByRole('button', { name: /View and review script/ })).toBeNull();
    expect(screen.queryByText('Completed')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'actions.viewDetails' })).toBeTruthy();
  });
});
