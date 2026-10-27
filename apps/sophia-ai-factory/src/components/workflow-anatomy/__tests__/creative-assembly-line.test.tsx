import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreativeAssemblyLine } from '../creative-assembly-line';
import {
  buildIllustrativeWorkflowView,
  buildVerifiedMissionWorkflowView,
} from '@/tree/mission/workflow-view-model';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('CreativeAssemblyLine Component', () => {
  it('renders illustration mode with all 5 interactive station tabs and SVG diagram', () => {
    const workflow = buildIllustrativeWorkflowView();
    render(<CreativeAssemblyLine workflow={workflow} />);

    const root = screen.getByTestId('creative-assembly-line');
    expect(root.getAttribute('data-workflow-mode')).toBe('illustration');

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);

    // Default active station in illustration mode is ceo_approval_gate (tab index 2)
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');

    // Click station 1 (intake_brief) and verify selection updates
    fireEvent.click(tabs[0]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[2].getAttribute('aria-selected')).toBe('false');
  });

  it('renders verified-job mode and displays error messages when a station fails', () => {
    const workflow = buildVerifiedMissionWorkflowView({
      missionId: 'msn_err_99',
      status: 'running',
      runs: [
        {
          status: 'failed',
          phase: 'executing',
          totalCostCents: 200,
          totalTokens: 800,
          errorMessage: 'D-ID render timeout',
        },
      ],
    });

    render(<CreativeAssemblyLine workflow={workflow} />);

    const root = screen.getByTestId('creative-assembly-line');
    expect(root.getAttribute('data-workflow-mode')).toBe('verified-job');
    expect(screen.getByText('D-ID render timeout')).toBeDefined();
  });
});
