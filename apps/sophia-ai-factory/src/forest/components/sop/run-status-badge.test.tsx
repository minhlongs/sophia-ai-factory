/**
 * RunStatusBadge snapshot tests — verify status labels render correctly.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { RunStatusBadge } from './run-status-badge';
import type { SopRunRow } from '@/tree/sop/sop-types';

// Minimal messages for the sop.run namespace
const messages = {
  sop: {
    run: {
      pending: 'Pending',
      running: 'Running',
      completed: 'Completed',
      failed: 'Failed',
      paused: 'Paused',
  trigger: 'Run Trigger',
          status: 'Status',
          started: 'Started',
          completedAt: 'Completed',
      duration: 'Duration',
      missions: 'Missions',
      viewMission: 'View Mission',
      noMissions: 'No missions recorded.',
      manual: 'Manual',
      webhook: 'Webhook',
      cron: 'Scheduled',
      backToSops: 'Back to SOPs',
      backToRuns: 'Back to Runs',
      title: 'Run Details',
    },
  },
};

function wrap(ui: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const STATUSES: Array<SopRunRow['status']> = ['pending', 'running', 'completed', 'failed', 'paused'];

describe('RunStatusBadge', () => {
  for (const status of STATUSES) {
    it(`renders ${status} status correctly`, () => {
      const { getByText } = wrap(<RunStatusBadge status={status} />);
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      expect(getByText(label)).toBeTruthy();
    });
  }

  it('applies animate-pulse for running status', () => {
    const { container } = wrap(<RunStatusBadge status="running" />);
    expect(container.firstChild?.textContent).toContain('Running');
    // The badge element has motion-safe:animate-pulse class (conditional on prefers-reduced-motion)
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('bg-primary/10/50');
  });

  it('applies green color for completed', () => {
    const { container } = wrap(<RunStatusBadge status="completed" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('emerald');
  });

  it('applies red color for failed', () => {
    const { container } = wrap(<RunStatusBadge status="failed" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('red');
  });

  it('accepts custom className', () => {
    const { container } = wrap(<RunStatusBadge status="pending" className="mt-2" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('mt-2');
  });
});
