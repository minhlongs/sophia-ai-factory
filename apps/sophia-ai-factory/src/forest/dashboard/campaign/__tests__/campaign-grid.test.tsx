import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampaignGrid } from '../campaign-grid';
import type { Campaign } from '@/seed/types';

vi.mock('../campaign-card', () => ({
  CampaignCard: ({ campaign, onSelect }: any) => (
    <div data-testid={`campaign-${campaign.id}`} onClick={() => onSelect(campaign)}>
      {campaign.title}
    </div>
  ),
}));

const mockCampaigns: Campaign[] = [
  { id: '1', title: 'Camp 1', status: 'draft', progress: 0, created_at: '', updated_at: '', user_id: '' },
  { id: '2', title: 'Camp 2', status: 'completed', progress: 100, created_at: '', updated_at: '', user_id: '' },
  { id: '3', title: 'Camp 3', status: 'processing_script', progress: 50, created_at: '', updated_at: '', user_id: '' },
];

describe('CampaignGrid', () => {
  it('renders all campaigns', () => {
    render(<CampaignGrid campaigns={mockCampaigns} onCampaignSelect={() => {}} />);
    expect(screen.getByTestId('campaign-1')).toBeDefined();
    expect(screen.getByTestId('campaign-2')).toBeDefined();
    expect(screen.getByTestId('campaign-3')).toBeDefined();
  });

  it('renders nothing when no campaigns', () => {
    render(<CampaignGrid campaigns={[]} onCampaignSelect={() => {}} />);
    expect(screen.queryByTestId(/campaign-/)).toBeNull();
  });

  it('applies custom className to grid container', () => {
    const { container } = render(
      <CampaignGrid campaigns={mockCampaigns} onCampaignSelect={() => {}} className="custom-grid" />
    );
    const gridDiv = container.firstChild as HTMLElement;
    expect(gridDiv.className).toContain('custom-grid');
  });
});
