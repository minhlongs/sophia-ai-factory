import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BriefingClient } from '../briefing-client';
import type { DailyBriefing } from '@/forest/agents/daily-briefing/briefing-types';

const MOCK_BRIEFING: DailyBriefing = {
  date: '2026-07-05',
  generatedAt: '2026-07-05T08:00:00.000Z',
  rawText: '## Revenue Snapshot\n$1,250 in revenue over the past 24 hours.\n\n## Campaign Status\n3 active campaigns.\n\n## Active Issues\nNone.\n\n## Summary\nProductive day ahead.',
  summary: 'Productive day ahead.',
  locale: 'en',
  generated: true,
};

const refreshActionMock = vi.fn(() => Promise.resolve({ ok: true, briefing: MOCK_BRIEFING }));

const baseProps = {
  locale: 'en',
  userId: 'user-under-test',
  initialBriefing: MOCK_BRIEFING,
  refreshAction: refreshActionMock,
  todayLabel: 'Daily Briefing — 2026-07-05',
  refreshLabel: 'Refresh Briefing',
  errorLabel: 'Unable to generate briefing right now.',
  emptyLabel: 'No briefing available for today.',
  retryLabel: 'Retry',
};

describe('BriefingClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders today label', () => {
    render(<BriefingClient {...baseProps} />);
    expect(screen.getByText('Daily Briefing — 2026-07-05')).toBeTruthy();
  });

  it('renders the DailyBriefingCard when briefing is generated', () => {
    render(<BriefingClient {...baseProps} initialBriefing={MOCK_BRIEFING} />);
    expect(screen.getByText('Revenue Snapshot')).toBeTruthy();
    expect(screen.getByText('3 active campaigns.')).toBeTruthy();
  });

  it('shows empty state when briefing is null and refresh button exists', async () => {
    render(<BriefingClient {...baseProps} initialBriefing={null} />);
    expect(screen.getByText('No briefing available for today.')).toBeTruthy();
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('renders vi strings when locale is vi (null briefing, empty-state branch)', () => {
    render(
      <BriefingClient
        {...baseProps}
        locale="vi"
        initialBriefing={null}
        todayLabel="Báo Cáo Sáng — 05/07/2026"
        emptyLabel="Chưa có báo cáo."
        retryLabel="Thử lại"
      />,
    );
    expect(screen.getByText('Báo Cáo Sáng — 05/07/2026')).toBeTruthy();
    expect(screen.getByText('Chưa có báo cáo.')).toBeTruthy();
    expect(screen.getByText('Thử lại')).toBeTruthy();
  });
});
