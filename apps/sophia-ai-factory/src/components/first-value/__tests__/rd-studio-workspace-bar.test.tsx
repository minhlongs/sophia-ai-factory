import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RdStudioWorkspaceBar } from '../affiliate-studio/rd-studio-workspace-bar';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('RdStudioWorkspaceBar (Zen Design OS 2026 4-Tab Studio)', () => {
  it('renders telemetry pills and switches across all 4 tabs + All View toggle', () => {
    const onTabChange = vi.fn();
    render(
      <RdStudioWorkspaceBar
        activeTab="setup"
        onTabChange={onTabChange}
        byokConfigured
        activeOfferName="Notion AI"
        activeCampaignTitle="Notion Review 2026"
        offersCount={2}
        campaignsCount={3}
      />,
    );

    expect(screen.getByTestId('rd-studio-workspace-bar')).toBeTruthy();
    expect(screen.getByText('BYOK: READY')).toBeTruthy();
    expect(screen.getByText('Notion AI')).toBeTruthy();

    fireEvent.click(screen.getByTestId('rd-studio-tab-script'));
    expect(onTabChange).toHaveBeenCalledWith('script');

    fireEvent.click(screen.getByTestId('rd-studio-tab-studio'));
    expect(onTabChange).toHaveBeenCalledWith('studio');

    fireEvent.click(screen.getByTestId('rd-studio-tab-ops'));
    expect(onTabChange).toHaveBeenCalledWith('ops');

    fireEvent.click(screen.getByTestId('rd-studio-tab-all'));
    expect(onTabChange).toHaveBeenCalledWith('all');
  });
});
