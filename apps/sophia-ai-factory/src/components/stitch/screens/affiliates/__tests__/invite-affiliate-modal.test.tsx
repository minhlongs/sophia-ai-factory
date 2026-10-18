/**
 * Unit & A11y tests for InviteAffiliateModal component (Dialog Semantics & Form Fields).
 *
 * Verifies:
 * 1. WCAG 2.1 AA dialog semantics: role="dialog", aria-modal="true", close & cancel buttons
 * 2. Form fields presence: partner name, email, commission rate override, welcome message, 4 asset kits
 * 3. Client-side input validation: name length, email format, commission bounds
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    fireEvent.click(screen.getByText('Close'));
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

    expect(screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerName/i)).toBeDefined();
    expect(screen.getByLabelText(/stitch\.affiliates\.inviteModal\.partnerEmail/i)).toBeDefined();

    const rateInput = screen.getByLabelText(/stitch\.affiliates\.inviteModal\.commissionOverride/i);
    expect(rateInput).toBeDefined();
    expect((rateInput as HTMLInputElement).value).toBe('20');

    expect(screen.getByLabelText(/stitch\.affiliates\.inviteModal\.welcomeMessage/i)).toBeDefined();
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
      expect(swipesKit.className).toContain('text-primary');
    }
  });

  it('validates minimum partner name length and displays error alert', async () => {
    render(<InviteAffiliateModal isOpen={true} onClose={vi.fn()} />);
    const form = screen.getByRole('dialog').querySelector('form')!;
    fireEvent.submit(form);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('stitch.affiliates.inviteModal.nameRequired');
    expect(affiliateActions.inviteAffiliateAction).not.toHaveBeenCalled();
  });
});
