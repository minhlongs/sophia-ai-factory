import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import messages from '../../../../../messages/en.json';
import { PaymentStep } from './payment-step';

function renderPaymentStep(props: React.ComponentProps<typeof PaymentStep>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PaymentStep {...props} />
    </NextIntlClientProvider>,
  );
}

describe('PaymentStep', () => {
  it('renders active plan, MCU balance, and direct provider billing details', () => {
    renderPaymentStep({
      onNext: vi.fn(),
      onBack: vi.fn(),
      currentTier: 'PREMIUM',
      mcuBalance: 850,
      subscriptionStatus: 'ACTIVE',
    });

    expect(screen.getByText('Growth')).toBeDefined();
    expect(screen.getByText('850 MCU')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();
    expect(screen.getByText(/Non-Technical Transparency Guarantee/i)).toBeDefined();
    expect(screen.getByText('Paid directly to your AI providers')).toBeDefined();
  });

  it('renders different tier details when currentTier changes', () => {
    renderPaymentStep({
      onNext: vi.fn(),
      onBack: vi.fn(),
      currentTier: 'ENTERPRISE',
    });

    expect(screen.getByText('Premium')).toBeDefined();
    expect(screen.getByText('$799 USDT per month')).toBeDefined();
  });

  it('shows MASTER as a one-time lifetime purchase with no renewal', () => {
    renderPaymentStep({ onNext: vi.fn(), onBack: vi.fn(), currentTier: 'MASTER' });

    expect(screen.getByText('$4,999 USDT one-time')).toBeDefined();
    expect(screen.getByText('No renewal')).toBeDefined();
  });

  it('triggers onNext and onBack callbacks', () => {
    const onNext = vi.fn();
    const onBack = vi.fn();

    renderPaymentStep({ onNext, onBack });

    fireEvent.click(screen.getByRole('button', { name: /Quay lại \/ Back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục \/ Continue/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
