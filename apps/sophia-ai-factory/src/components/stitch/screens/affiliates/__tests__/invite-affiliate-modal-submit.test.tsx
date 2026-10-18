/**
 * Unit & Integration tests for InviteAffiliateModal submission & validation flow.
 *
 * Verifies:
 * 1. Email format and commission rate bounds validation
 * 2. Submission workflow: connects to inviteAffiliateAction, displays loading & success states
 * 3. Clipboard link copying, callbacks, and server error message handling
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteAffiliateModal } from '../invite-affiliate-modal';
import * as affiliateActions from '@/forest/actions/affiliate-actions';

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${namespace || ''}.${key}:${JSON.stringify(params)}`;
    return `${namespace || ''}.${key}`;
  },
  useLocale: () => 'en',
}));

vi.mock('@/forest/actions/affiliate-actions', () => ({
  inviteAffiliateAction: vi.fn(),
}));

describe('InviteAffiliateModal Validation & Submission Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates email format and displays error alert', async () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    const nameInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerName/i);
    const emailInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerEmail/i);
    const form = screen.getByRole('dialog').querySelector('form')!;

    fireEvent.change(nameInput, { target: { value: 'Alex Mercer' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.submit(form);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('stitch.affiliates.inviteModal.emailInvalid');
    expect(affiliateActions.inviteAffiliateAction).not.toHaveBeenCalled();
  });

  it('validates custom commission rate bounds (5% to 80%)', async () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    const nameInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerName/i);
    const emailInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerEmail/i);
    const rateInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.commissionOverride/i);
    const form = screen.getByRole('dialog').querySelector('form')!;

    fireEvent.change(nameInput, { target: { value: 'Alex Mercer' } });
    fireEvent.change(emailInput, { target: { value: 'alex@example.com' } });
    fireEvent.change(rateInput, { target: { value: '95' } });
    fireEvent.submit(form);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('stitch.affiliates.inviteModal.rateInvalid');
    expect(affiliateActions.inviteAffiliateAction).not.toHaveBeenCalled();
  });

  it('successfully dispatches invitation and renders link with callback', async () => {
    const handleSuccess = vi.fn();
    const mockResult = {
      success: true,
      inviteId: 'aff_inv_123',
      emailDispatched: true,
      inviteLink: 'https://sophia.agencyos.network/affiliate/join?token=mock_tok_456',
    };

    vi.mocked(affiliateActions.inviteAffiliateAction).mockResolvedValueOnce(mockResult);

    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} onInviteSuccess={handleSuccess} />);

    const nameInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerName/i);
    const emailInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerEmail/i);
    const rateInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.commissionOverride/i);
    const messageInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.welcomeMessage/i);
    const form = screen.getByRole('dialog').querySelector('form')!;

    fireEvent.change(nameInput, { target: { value: 'Apex Agency' } });
    fireEvent.change(emailInput, { target: { value: 'contact@apexagency.com' } });
    fireEvent.change(rateInput, { target: { value: '35' } });
    fireEvent.change(messageInput, { target: { value: 'Welcome to our VIP partner tier!' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(affiliateActions.inviteAffiliateAction).toHaveBeenCalledWith({
        partnerName: 'Apex Agency',
        email: 'contact@apexagency.com',
        customRateOverridePct: 35,
        welcomeMessage: 'Welcome to our VIP partner tier!',
        assetKitSelected: expect.arrayContaining(['brand_kit', 'video_scripts']),
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText('stitch.affiliates.inviteModal.success:{"email":"contact@apexagency.com"}'),
      ).toBeDefined();
    });

    expect(handleSuccess).toHaveBeenCalledWith(mockResult);
    expect(screen.getByDisplayValue(mockResult.inviteLink)).toBeDefined();

    const copyBtn = screen.getByRole('button', {
      name: /stitch\.affiliates\.inviteModal\.copyLink/i,
    });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText('stitch.affiliates.inviteModal.copied')).toBeDefined();
    });
  });

  it('displays server error message when action returns success=false', async () => {
    vi.mocked(affiliateActions.inviteAffiliateAction).mockResolvedValueOnce({
      success: false,
      error: 'Rate limit exceeded for today',
    });

    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    const nameInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerName/i);
    const emailInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerEmail/i);
    const form = screen.getByRole('dialog').querySelector('form')!;

    fireEvent.change(nameInput, { target: { value: 'Apex Agency' } });
    fireEvent.change(emailInput, { target: { value: 'apex@example.com' } });
    fireEvent.submit(form);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Rate limit exceeded for today');
  });
});
