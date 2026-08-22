/**
 * Tests for LearningRecommendationCard component.
 * next-intl is mocked with an identity translator (returns the key).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { LearningRecommendationCard } from '../learning-recommendation-card';

const pendingRec = {
  id: 'rec-1',
  category: 'titles',
  title: 'Use question-style titles',
  rationale: 'Question titles increase CTR by 12%.',
  evidence: { ctrDelta: 0.12, sampleSize: 30 },
  proposedChange: { titleStyle: 'question' },
  confidence: 'high' as const,
  status: 'pending' as const,
};

describe('LearningRecommendationCard', () => {
  it('renders title and rationale', () => {
    render(<LearningRecommendationCard recommendation={pendingRec} />);
    expect(screen.getByText('Use question-style titles')).toBeTruthy();
    expect(screen.getByText('Question titles increase CTR by 12%.')).toBeTruthy();
  });

  it('renders category badge', () => {
    render(<LearningRecommendationCard recommendation={pendingRec} />);
    expect(screen.getByText('titles')).toBeTruthy();
  });

  it('renders confidence badge', () => {
    render(<LearningRecommendationCard recommendation={pendingRec} />);
    expect(screen.getByText(/confidence/)).toBeTruthy();
  });

  it('shows approve and reject buttons when pending', () => {
    render(<LearningRecommendationCard recommendation={pendingRec} />);
    expect(screen.getByRole('button', { name: /approve/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reject/ })).toBeTruthy();
  });

  it('hides action buttons when decided', () => {
    const decided = { ...pendingRec, status: 'approved' as const };
    render(<LearningRecommendationCard recommendation={decided} />);
    expect(screen.queryByRole('button', { name: /approve/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject/ })).toBeNull();
  });

  it('shows approved label when approved', () => {
    const decided = { ...pendingRec, status: 'approved' as const };
    render(<LearningRecommendationCard recommendation={decided} />);
    expect(screen.getAllByText('approved').length).toBeGreaterThan(0);
  });

  it('shows rejected label when rejected', () => {
    const decided = { ...pendingRec, status: 'rejected' as const };
    render(<LearningRecommendationCard recommendation={decided} />);
    expect(screen.getAllByText('rejected').length).toBeGreaterThan(0);
  });

  it('calls onApprove when approve button clicked', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(
      <LearningRecommendationCard recommendation={pendingRec} onApprove={onApprove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /approve/ }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith('rec-1'));
  });

  it('calls onReject when reject button clicked', async () => {
    const onReject = vi.fn().mockResolvedValue(undefined);
    render(
      <LearningRecommendationCard recommendation={pendingRec} onReject={onReject} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /reject/ }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith('rec-1'));
  });

  it('disables buttons while busy', async () => {
    const onApprove = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 50);
        }),
    );
    render(
      <LearningRecommendationCard recommendation={pendingRec} onApprove={onApprove} />,
    );
    const approveBtn = screen.getByRole('button', { name: /approve/ });
    fireEvent.click(approveBtn);
    expect((approveBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders evidence block when evidence present', () => {
    render(<LearningRecommendationCard recommendation={pendingRec} />);
    expect(screen.getByText('evidence')).toBeTruthy();
  });

  it('does not render evidence block when empty', () => {
    const noEvidence = { ...pendingRec, evidence: {} };
    render(<LearningRecommendationCard recommendation={noEvidence} />);
    expect(screen.queryByText('evidence')).toBeNull();
  });

  it('renders proposed change block when present', () => {
    render(<LearningRecommendationCard recommendation={pendingRec} />);
    expect(screen.getByText('proposedChange')).toBeTruthy();
  });

  it('renders error message when action fails', async () => {
    const onApprove = vi.fn().mockRejectedValue(new Error('network down'));
    render(
      <LearningRecommendationCard recommendation={pendingRec} onApprove={onApprove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /approve/ }));
    await waitFor(() => expect(screen.getByText('network down')).toBeTruthy());
  });

  it('renders low confidence styling', () => {
    const low = { ...pendingRec, confidence: 'low' as const };
    render(<LearningRecommendationCard recommendation={low} />);
    const badge = screen.getByText(/confidence/).closest('span');
    expect(badge?.className).toContain('bg-rose-50');
  });
});
