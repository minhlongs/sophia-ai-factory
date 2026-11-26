import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RdStudioWorkspaceBar } from '../affiliate-studio/rd-studio-workspace-bar';
import { RdStudioPipelineCanvas } from '../affiliate-studio/rd-studio-pipeline-canvas';

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

  it('renders 5-node Visual Pipeline Canvas and switches tabs on node click', () => {
    const onSelectTab = vi.fn();
    render(
      <RdStudioPipelineCanvas
        activeTab="setup"
        onSelectTab={onSelectTab}
        byokConfigured
        offersCount={2}
        campaignsCount={1}
        hasApprovedCampaign
        mp4Count={1}
        linksCount={1}
        verifiedClicks={12}
        manualPublishesCount={1}
      />,
    );

    expect(screen.getByTestId('rd-studio-pipeline-canvas')).toBeTruthy();
    fireEvent.click(screen.getByTestId('node-script'));
    expect(onSelectTab).toHaveBeenCalledWith('script');
    fireEvent.click(screen.getByTestId('node-media'));
    expect(onSelectTab).toHaveBeenCalledWith('studio');
    fireEvent.click(screen.getByTestId('node-rev'));
    expect(onSelectTab).toHaveBeenCalledWith('ops');
  });
});
