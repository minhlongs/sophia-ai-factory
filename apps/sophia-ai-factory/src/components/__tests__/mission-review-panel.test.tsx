/**
 * Tests for MissionReviewPanel — the human review decision surface.
 * Mocks the land Server Action and router; asserts the two legal
 * transitions (completed | iterating), busy-disable, and failure UX.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const updateMissionStatusMock = vi.fn();

vi.mock('@/land/creative-mission/actions', () => ({
  updateMissionStatus: (...args: unknown[]) => updateMissionStatusMock(...args),
}));

// next-intl mock: returns the key itself (with interpolated code when present)
vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string>) =>
      values && values.code ? `${key}:${values.code}` : key,
}));

import { MissionReviewPanel } from '../mission-review-panel';

describe('MissionReviewPanel', () => {
  beforeEach(() => {
    updateMissionStatusMock.mockReset();
    refreshMock.mockReset();
  });

  it('renders the title, human-ownership note, and both decision buttons', () => {
    render(<MissionReviewPanel missionId="m1" />);
    expect(screen.getByText('review.title')).toBeTruthy();
    expect(screen.getByText('review.humanNote')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'review.approve' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'review.iterating' })).toBeTruthy();
  });

  it('approve calls updateMissionStatus with completed and refreshes on success', async () => {
    updateMissionStatusMock.mockResolvedValue({ ok: true, value: { missionId: 'm1' } });

    render(<MissionReviewPanel missionId="m1" />);
    fireEvent.click(screen.getByRole('button', { name: 'review.approve' }));

    await waitFor(() => {
      expect(updateMissionStatusMock).toHaveBeenCalledWith({ missionId: 'm1', status: 'completed' });
    });
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('review.approveSuccess')).toBeTruthy();
  });

  it('iterate calls updateMissionStatus with iterating and refreshes on success', async () => {
    updateMissionStatusMock.mockResolvedValue({ ok: true, value: { missionId: 'm1' } });

    render(<MissionReviewPanel missionId="m1" />);
    fireEvent.click(screen.getByRole('button', { name: 'review.iterating' }));

    await waitFor(() => {
      expect(updateMissionStatusMock).toHaveBeenCalledWith({ missionId: 'm1', status: 'iterating' });
    });
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('review.iterateSuccess')).toBeTruthy();
  });

  it('disables both buttons while a decision is pending (double-submit guard)', async () => {
    let resolveAction: ((v: unknown) => void) | undefined;
    updateMissionStatusMock.mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );

    render(<MissionReviewPanel missionId="m1" />);
    fireEvent.click(screen.getByRole('button', { name: 'review.approve' }));

    const buttons = screen.getAllByRole('button');
    const disabledStates = buttons.map((b) => (b as HTMLButtonElement).disabled);
    expect(disabledStates).toEqual([true, true]);

    resolveAction?.({ ok: true, value: { missionId: 'm1' } });
    await waitFor(() => {
      const reenabled = screen.getAllByRole('button').map((b) => (b as HTMLButtonElement).disabled);
      expect(reenabled).toEqual([false, false]);
    });
  });

  it('shows an inline error with the failure code and resyncs via router.refresh', async () => {
    updateMissionStatusMock.mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_TRANSITION', message: 'review → running not allowed' },
    });

    render(<MissionReviewPanel missionId="m1" />);
    fireEvent.click(screen.getByRole('button', { name: 'review.approve' }));

    expect(await screen.findByText('review.actionFailed:INVALID_TRANSITION')).toBeTruthy();
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows a NETWORK error when the action call throws', async () => {
    updateMissionStatusMock.mockRejectedValue(new Error('offline'));

    render(<MissionReviewPanel missionId="m1" />);
    fireEvent.click(screen.getByRole('button', { name: 'review.iterating' }));

    expect(await screen.findByText('review.actionFailed:NETWORK')).toBeTruthy();
    expect(refreshMock).toHaveBeenCalled();
  });
});
