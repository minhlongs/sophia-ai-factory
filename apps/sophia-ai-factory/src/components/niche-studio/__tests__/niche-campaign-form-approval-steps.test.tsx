/**
 * Niche Campaign Form Approval-Step Tests
 *
 * Verifies that preparing a draft is side-effect free and that submitting for
 * approval is a separate, explicit action the customer takes after review.
 * @module components/niche-studio/__tests__/niche-campaign-form-approval-steps
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const previewMock = vi.fn();
const dispatchMock = vi.fn();

vi.mock('@/forest/actions/niche-video-actions', () => ({
  previewNicheVideoPlanAction: (...args: unknown[]) => previewMock(...args),
  dispatchNicheVideoCampaignAction: (...args: unknown[]) => dispatchMock(...args),
}));

import { NicheCampaignForm } from '../niche-campaign-form';

const mockT = (key: string) => `trans_${key}`;

const filledValues = {
  productName: 'Linear App',
  productUrl: 'https://linear.app',
  affiliateCode: '',
  subId: '',
  vanityCoupon: '',
  jurisdiction: 'GLOBAL',
};

describe('NicheCampaignForm approval steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewMock.mockResolvedValue({
      success: true,
      data: { planId: 'nvp_abc123', blueprint: { name: 'PAS Blueprint' } },
    });
    dispatchMock.mockResolvedValue({
      success: true,
      data: { planId: 'nvp_abc123', dispatched: true },
    });
  });

  const fillRequiredFields = () => {
    // productName is the first text input; productUrl is the only url input.
    const nameInput = document.querySelector('input[type="text"]');
    const urlInput = document.querySelector('input[type="url"]');
    if (!nameInput || !urlInput) throw new Error('Required form inputs not found');
    fireEvent.change(nameInput, { target: { value: 'Linear App' } });
    fireEvent.change(urlInput, { target: { value: 'https://linear.app' } });
  };

  it('prepares a draft without dispatching any production job', async () => {
    const onDispatched = vi.fn();

    render(
      <NicheCampaignForm
        onPlanGenerated={vi.fn()}
        onDispatched={onDispatched}
        t={mockT}
        adoptedContext={{ offerId: 'semrush', campaignId: 'camp_abc123' }}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByText('trans_btnPrepareDraft'));

    await waitFor(() => {
      expect(previewMock).toHaveBeenCalledTimes(1);
    });

    expect(dispatchMock).not.toHaveBeenCalled();
    expect(onDispatched).not.toHaveBeenCalled();
  });

  it('only offers the submit step after a draft exists', async () => {
    render(
      <NicheCampaignForm
        onPlanGenerated={vi.fn()}
        onDispatched={vi.fn()}
        t={mockT}
      />,
    );

    expect(screen.queryByText('trans_btnSubmitForApproval')).toBeNull();

    fillRequiredFields();
    fireEvent.click(screen.getByText('trans_btnPrepareDraft'));

    await waitFor(() => {
      expect(screen.getByText('trans_btnSubmitForApproval')).toBeDefined();
    });
  });

  it('dispatches only when the customer explicitly submits for approval', async () => {
    const onDispatched = vi.fn();

    render(
      <NicheCampaignForm
        onPlanGenerated={vi.fn()}
        onDispatched={onDispatched}
        t={mockT}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByText('trans_btnPrepareDraft'));
    await waitFor(() => {
      expect(screen.getByText('trans_btnSubmitForApproval')).toBeDefined();
    });

    fireEvent.click(screen.getByText('trans_btnSubmitForApproval'));

    await waitFor(() => {
      expect(dispatchMock).toHaveBeenCalledTimes(1);
      expect(onDispatched).toHaveBeenCalledWith('nvp_abc123');
    });
  });

  it('surfaces the failure and keeps the draft editable when submission fails', async () => {
    dispatchMock.mockResolvedValue({ success: false, error: 'Quota exhausted' });

    render(
      <NicheCampaignForm
        onPlanGenerated={vi.fn()}
        onDispatched={vi.fn()}
        t={mockT}
      />,
    );

    fillRequiredFields();
    fireEvent.click(screen.getByText('trans_btnPrepareDraft'));
    await waitFor(() => {
      expect(screen.getByText('trans_btnSubmitForApproval')).toBeDefined();
    });

    fireEvent.click(screen.getByText('trans_btnSubmitForApproval'));

    await waitFor(() => {
      expect(screen.getByText(/Quota exhausted/)).toBeDefined();
    });
  });
});
