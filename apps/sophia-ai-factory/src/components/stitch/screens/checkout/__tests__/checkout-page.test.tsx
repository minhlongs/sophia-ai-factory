import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { CheckoutPage } from '../checkout-page';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe('CheckoutPage', () => {
  it('renders checkout page with plan options and order summary', () => {
    render(<CheckoutPage />);
    expect(screen.getByText('payment.title')).toBeDefined();
    expect(screen.getByText('payment.orderSummary')).toBeDefined();
  });
});
