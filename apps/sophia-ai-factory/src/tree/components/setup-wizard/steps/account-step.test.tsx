import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountStep } from './account-step';

describe('AccountStep', () => {
  it('renders ownership identity and tenant isolation', () => {
    render(
      <AccountStep
        onNext={vi.fn()}
        onBack={vi.fn()}
        accountEmail="ceo@testagency.com"
        isOwner={true}
      />
    );

    expect(screen.getByText('ceo@testagency.com')).toBeDefined();
    expect(screen.getByText('OWNER / Quản trị cao nhất')).toBeDefined();
    expect(screen.getByText(/Isolated & Secure \(AES-256\)/i)).toBeDefined();
    expect(screen.getByText(/Active Owner \/ Chủ sở hữu/i)).toBeDefined();
  });

  it('allows changing workspace name and triggers navigation', () => {
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <AccountStep
        onNext={onNext}
        onBack={onBack}
        accountEmail="founder@test.com"
      />
    );

    const input = screen.getByPlaceholderText(/e\.g\. My Media Brand/i);
    fireEvent.change(input, { target: { value: 'New Agency Name' } });
    expect((input as HTMLInputElement).value).toBe('New Agency Name');

    fireEvent.click(screen.getByRole('button', { name: /Quay lại \/ Back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục \/ Continue/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
