/**
 * Unit tests for Stitch UI primitives (Input, Textarea, Button).
 *
 * Verifies accessibility (ARIA) requirements:
 * 1. Input/Textarea auto-links error message via aria-describedby and id
 * 2. Input/Textarea sets aria-invalid when in error state
 * 3. Error messages render with role="alert"
 * 4. Button sets aria-busy and disabled when loading
 * 5. Button link variant sets aria-disabled, aria-busy, and tabIndex when disabled/loading
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Input, Textarea } from '../input';
import { Button } from '../button';

// Mock navigation Link
vi.mock('@/navigation', () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe('Stitch Input & Textarea Accessibility', () => {
  it('renders input with aria-invalid and links aria-describedby to error message', () => {
    render(
      <Input
        placeholder="Enter name"
        error={true}
        errorMessage="Name is required"
      />
    );

    const input = screen.getByPlaceholderText('Enter name');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toBe('Name is required');

    const errorId = alert.getAttribute('id');
    expect(errorId).toBeTruthy();
    expect(input.getAttribute('aria-describedby')).toBe(errorId);
  });

  it('renders textarea with aria-invalid and links aria-describedby to error message', () => {
    render(
      <Textarea
        placeholder="Enter description"
        error={true}
        errorMessage="Description too short"
      />
    );

    const textarea = screen.getByPlaceholderText('Enter description');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
    expect(alert.textContent).toBe('Description too short');

    const errorId = alert.getAttribute('id');
    expect(errorId).toBeTruthy();
    expect(textarea.getAttribute('aria-describedby')).toBe(errorId);
  });

  it('does not set aria-invalid or aria-describedby when not in error state', () => {
    render(<Input placeholder="Clean input" />);
    const input = screen.getByPlaceholderText('Clean input');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Stitch Button Accessibility', () => {
  it('sets disabled and aria-busy when loading={true}', () => {
    render(<Button loading={true}>Submit Action</Button>);
    const button = screen.getByRole('button');
    expect(button.getAttribute('disabled')).not.toBeNull();
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('sets aria-disabled, aria-busy, and tabIndex="-1" on link when loading', () => {
    render(
      <Button href="/dashboard" loading={true}>
        Navigate Link
      </Button>
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('aria-busy')).toBe('true');
    expect(link.getAttribute('tabindex')).toBe('-1');
  });

  it('sets aria-disabled and tabIndex="-1" on link when disabled', () => {
    render(
      <Button href="/settings" disabled={true}>
        Disabled Link
      </Button>
    );
    const link = screen.getByRole('link');
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('tabindex')).toBe('-1');
  });
});
