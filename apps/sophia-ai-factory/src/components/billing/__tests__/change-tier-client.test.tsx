/**
 * Unit tests for ChangeTierClient component.
 *
 * Verifies:
 * 1. Correct rendering of plans and Master tier hint.
 * 2. Selecting an upgrade tier displays upgrade notice and 'Proceed to Checkout'.
 * 3. Clicking upgrade redirects to /api/checkout?tier=...
 * 4. Selecting a downgrade tier displays downgrade timing choices and opens confirmation modal.
 * 5. Confirming downgrade invokes changeTierAction with selected timing and displays success card.
 *
 * @module components/billing/__tests__/change-tier-client.test
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChangeTierClient from '../change-tier-client';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: 'Change Plan',
      description: 'Select a new plan for your subscription',
      upgrade: 'Upgrade',
      downgrade: 'Downgrade',
      submit: 'Confirm Change',
      submitting: 'Changing plan...',
      proceed_checkout: 'Proceed to Checkout',
      upgrade_notice: 'Upgrades take effect immediately upon payment confirmation.',
      timing_title: 'When should the change take effect?',
      timing_subtitle: 'Choose when to apply this plan change',
      timing_immediate_label: 'Immediately',
      timing_immediate_desc: 'Changes take effect right away',
      timing_eoc_label: 'End of Billing Cycle',
      timing_eoc_desc: 'Changes take effect when current period ends',
      master_title: 'Master Tier',
      master_hint: 'Lifetime access — no renewal fees',
      master_cta: 'Contact Support',
      confirm_downgrade_title: 'Confirm Downgrade',
      confirm_lose_title: 'You will lose access to:',
      confirm_downgrade_confirm: 'Confirm Downgrade',
      success_title: 'Plan Changed',
      success_immediate: 'Your plan has been upgraded.',
      success_end_of_cycle: 'Your plan will change at the end of the billing cycle.',
    };
    return translations[key] ?? key;
  },
}));

// Mock changeTierAction
const mockChangeTierAction = vi.fn();
vi.mock('@/app/actions/billing', () => ({
  changeTierAction: (...args: unknown[]) => mockChangeTierAction(...args),
}));

describe('ChangeTierClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  it('renders initial state with tier selector and master tier banner', () => {
    render(<ChangeTierClient currentTier="BASIC" />);

    expect(screen.getByText('Master Tier')).toBeDefined();
    expect(screen.getByText('Lifetime access — no renewal fees')).toBeDefined();
    expect(screen.getByRole('button', { name: /Confirm Change/i })).toBeDefined();
  });

  it('shows upgrade notice and redirect to checkout when selecting a higher tier', () => {
    render(<ChangeTierClient currentTier="BASIC" />);

    // Click on Growth plan (PREMIUM tier)
    const growthBtn = screen.getByRole('button', { name: /Growth/i });
    fireEvent.click(growthBtn);

    // Upgrade notice should appear
    expect(screen.getByText(/Upgrade: PREMIUM/i)).toBeDefined();
    expect(screen.getByText(/Upgrades take effect immediately upon payment confirmation/i)).toBeDefined();

    // Button should now say Proceed to Checkout
    const checkoutBtn = screen.getByRole('button', { name: /Proceed to Checkout/i });
    expect(checkoutBtn).toBeDefined();

    fireEvent.click(checkoutBtn);
    expect(window.location.href).toBe('/api/checkout?tier=premium');
  });

  it('shows downgrade timing selector when selecting a lower tier', () => {
    render(<ChangeTierClient currentTier="ENTERPRISE" />);

    // Click on Starter plan (BASIC tier, downgrade)
    const starterBtn = screen.getByRole('button', { name: /Starter/i });
    fireEvent.click(starterBtn);

    // Downgrade timing options should appear
    expect(screen.getByText('When should the change take effect?')).toBeDefined();
    expect(screen.getByText('End of Billing Cycle')).toBeDefined();
    expect(screen.getByText('Immediately')).toBeDefined();

    // Button remains Confirm Change
    const submitBtn = screen.getByRole('button', { name: /Confirm Change/i });
    expect(submitBtn).toBeDefined();

    // Clicking opens the modal
    fireEvent.click(submitBtn);
    expect(screen.getByRole('heading', { name: /Confirm Downgrade/i })).toBeDefined();
  });

  it('executes downgrade via changeTierAction and displays success state', async () => {
    mockChangeTierAction.mockResolvedValueOnce({
      success: true,
      tier: 'BASIC',
      effectiveAt: '2026-10-01T00:00:00.000Z',
    });

    render(<ChangeTierClient currentTier="PREMIUM" />);

    // Select Starter plan (BASIC tier, downgrade)
    const starterBtn = screen.getByRole('button', { name: /Starter/i });
    fireEvent.click(starterBtn);

    // Open confirmation modal
    const changeBtn = screen.getByRole('button', { name: /Confirm Change/i });
    fireEvent.click(changeBtn);

    // In modal, click final confirm
    const modalConfirmBtns = screen.getAllByRole('button', { name: /Confirm Downgrade/i });
    const finalConfirm = modalConfirmBtns[modalConfirmBtns.length - 1];
    fireEvent.click(finalConfirm);

    await waitFor(() => {
      expect(mockChangeTierAction).toHaveBeenCalledWith('BASIC', 'end_of_cycle');
      expect(screen.getByText('Plan Changed')).toBeDefined();
    });
  });
});
