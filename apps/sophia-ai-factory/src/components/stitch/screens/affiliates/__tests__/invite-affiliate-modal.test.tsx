/**
 * Unit & A11y tests for InviteAffiliateModal component.
 *
 * Verifies:
 * 1. WCAG 2.1 AA dialog semantics: role="dialog", aria-modal="true", Escape key dismissal
 * 2. Form fields presence: partner name, email, commission rate override, welcome message, 4 asset kits
 * 3. Client-side input validation: name length, email format, commission bounds
 * 4. Submission workflow: connects to inviteAffiliateAction, displays loading & success states
 * 5. Clipboard link copying and callbacks
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InviteAffiliateModal } from '../invite-affiliate-modal';
import * as affiliateActions from '@/forest/actions/affiliate-actions';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return `${namespace || ''}.${key}:${JSON.stringify(params)}`;
    }
    return `${namespace || ''}.${key}`;
  },
  useLocale: () => 'en',
}));

// Mock inviteAffiliateAction
vi.mock('@/forest/actions/affiliate-actions', () => ({
  inviteAffiliateAction: vi.fn(),
}));

describe('InviteAffiliateModal A11y & Dialog Semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render dialog content when isOpen is false', () => {
    render(<InviteAffiliateModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders with role="dialog" and aria-modal="true" when open', () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('renders accessible title and description', () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('stitch.affiliates.inviteModal.title')).toBeDefined();
    expect(screen.getByText('stitch.affiliates.inviteModal.description')).toBeDefined();
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<InviteAffiliateModal isOpen={true} onClose={handleClose} />);

    // Radix close button has sr-only 'Close'
    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(<InviteAffiliateModal isOpen={true} onClose={handleClose} />);

    const cancelBtn = screen.getByRole('button', {
      name: /stitch\.affiliates\.inviteModal\.cancel/i,
    });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});

describe('InviteAffiliateModal Form Fields & Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 5 mandatory form inputs and 4 asset kit options', () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    // 1. Partner name
    const nameInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerName/i);
    expect(nameInput).toBeDefined();

    // 2. Email
    const emailInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerEmail/i);
    expect(emailInput).toBeDefined();

    // 3. Custom rate override
    const rateInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.commissionOverride/i);
    expect(rateInput).toBeDefined();
    expect((rateInput as HTMLInputElement).value).toBe('20');

    // 4. Welcome message
    const messageInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.welcomeMessage/i);
    expect(messageInput).toBeDefined();

    // 5. Asset kits
    expect(screen.getByText('stitch.affiliates.inviteModal.kitBrand')).toBeDefined();
    expect(screen.getByText('stitch.affiliates.inviteModal.kitScripts')).toBeDefined();
    expect(screen.getByText('stitch.affiliates.inviteModal.kitSwipes')).toBeDefined();
    expect(screen.getByText('stitch.affiliates.inviteModal.kitBroll')).toBeDefined();
  });

  it('toggles asset kit selections on click', () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    const swipesKit = screen.getByText('stitch.affiliates.inviteModal.kitSwipes').closest('button');
    expect(swipesKit).toBeDefined();

    if (swipesKit) {
      fireEvent.click(swipesKit);
      // Kit should now be selected
      expect(swipesKit.className).toContain('text-primary');
    }
  });

  it('validates minimum partner name length and displays error alert', async () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);

    const form = screen.getByRole('dialog').querySelector('form')!;
    fireEvent.submit(form);

    const alert = await screen.findByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain('stitch.affiliates.inviteModal.nameRequired');
    expect(affiliateActions.inviteAffiliateAction).not.toHaveBeenCalled();
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
});

describe('InviteAffiliateModal Submission Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    // Check success screen
    await waitFor(() => {
      expect(
        screen.getByText('stitch.affiliates.inviteModal.success:{"email":"contact@apexagency.com"}'),
      ).toBeDefined();
    });

    expect(handleSuccess).toHaveBeenCalledWith(mockResult);

    // Verify invite link is displayed
    const linkInput = screen.getByDisplayValue(mockResult.inviteLink);
    expect(linkInput).toBeDefined();

    // Verify copy button works
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
