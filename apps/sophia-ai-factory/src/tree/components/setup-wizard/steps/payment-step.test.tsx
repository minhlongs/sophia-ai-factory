import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentStep } from './payment-step';

describe('PaymentStep', () => {
  it('renders active plan, MCU balance, and 0% markup guarantee', () => {
    render(
      <PaymentStep
        onNext={vi.fn()}
        onBack={vi.fn()}
        currentTier="PREMIUM"
        mcuBalance={850}
        subscriptionStatus="ACTIVE"
      />
    );

    expect(screen.getByText('Premium Tier')).toBeDefined();
    expect(screen.getByText('850 MCU')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();
    expect(screen.getByText(/Non-Technical Transparency Guarantee/i)).toBeDefined();
    expect(screen.getByText(/Billed directly by providers \(0% fee\)/i)).toBeDefined();
  });

  it('renders different tier details when currentTier changes', () => {
    render(
      <PaymentStep
        onNext={vi.fn()}
        onBack={vi.fn()}
        currentTier="ENTERPRISE"
      />
    );

    expect(screen.getByText('Enterprise Tier')).toBeDefined();
    expect(screen.getByText('$299/mo')).toBeDefined();
  });

  it('triggers onNext and onBack callbacks', () => {
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <PaymentStep
        onNext={onNext}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Quay lại \/ Back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục \/ Continue/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
