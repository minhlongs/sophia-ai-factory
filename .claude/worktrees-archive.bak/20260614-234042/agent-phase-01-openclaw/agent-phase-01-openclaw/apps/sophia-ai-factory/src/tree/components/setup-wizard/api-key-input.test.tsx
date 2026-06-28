// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ApiKeyInput } from './api-key-input';

describe('ApiKeyInput Component', () => {
  const defaultProps = {
    id: 'test-api-key',
    label: 'OpenRouter API Key',
    value: '',
    onChange: vi.fn(),
    onVerify: vi.fn(),
    status: 'idle' as const,
    errorMessage: '',
    placeholder: 'Enter key...',
    helpText: 'Get your key from the dashboard',
    required: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders input, label, and helpText when provided', () => {
    render(<ApiKeyInput {...defaultProps} />);

    expect(screen.getByLabelText(/OpenRouter API Key/i)).toBeDefined();
    expect(screen.getByPlaceholderText('Enter key...')).toBeDefined();
    expect(screen.getByText('Get your key from the dashboard')).toBeDefined();
  });

  it('toggles password visibility when the eye button is clicked', () => {
    render(<ApiKeyInput {...defaultProps} value="sk-or-v1-mysecretkey" />);
    
    const input = screen.getByLabelText(/OpenRouter API Key/i) as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggleButton = screen.getByRole('button', { name: /Show API key/i });
    fireEvent.click(toggleButton);

    expect(input.type).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: /Hide API key/i }));
    expect(input.type).toBe('password');
  });

  it('measures and displays latency on successful verification', async () => {
    vi.useFakeTimers();
    const mockOnVerify = vi.fn().mockImplementation(async () => {
      vi.advanceTimersByTime(150);
    });

    const { rerender } = render(
      <ApiKeyInput
        {...defaultProps}
        value="sk-or-v1-mysecretkey"
        onVerify={mockOnVerify}
      />
    );

    const verifyButton = screen.getByRole('button', { name: 'Verify' });
    fireEvent.click(verifyButton);

    await vi.runAllTimersAsync();

    rerender(
      <ApiKeyInput
        {...defaultProps}
        value="sk-or-v1-mysecretkey"
        status="valid"
        onVerify={mockOnVerify}
      />
    );

    expect(screen.getByText(/Connection active/i)).toBeDefined();
    expect(screen.getByText(/\(150ms\)/i)).toBeDefined();

    vi.useRealTimers();
  });

  it('renders error message and latency on failed verification', async () => {
    vi.useFakeTimers();
    const mockOnVerify = vi.fn().mockImplementation(async () => {
      vi.advanceTimersByTime(250);
      throw new Error('Connection failed');
    });

    const { rerender } = render(
      <ApiKeyInput
        {...defaultProps}
        value="sk-or-v1-mysecretkey"
        onVerify={mockOnVerify}
      />
    );

    const verifyButton = screen.getByRole('button', { name: 'Verify' });
    fireEvent.click(verifyButton);

    await vi.runAllTimersAsync();

    rerender(
      <ApiKeyInput
        {...defaultProps}
        value="sk-or-v1-mysecretkey"
        status="invalid"
        errorMessage="Invalid key format or network error"
        onVerify={mockOnVerify}
      />
    );

    expect(screen.getByText(/Invalid key format or network error/i)).toBeDefined();
    expect(screen.getByText(/\(took 250ms\)/i)).toBeDefined();

    vi.useRealTimers();
  });

  it('displays transition state while validating', () => {
    render(<ApiKeyInput {...defaultProps} status="validating" />);
    expect(screen.getByText(/Verifying connection\.\.\./i)).toBeDefined();
  });

  it('resets latency and connection badges when typing in input', async () => {
    vi.useFakeTimers();
    const mockOnVerify = vi.fn().mockImplementation(async () => {
      vi.advanceTimersByTime(100);
    });

    const onChangeSpy = vi.fn();
    const { rerender } = render(
      <ApiKeyInput
        {...defaultProps}
        value="sk-or-v1-mysecretkey"
        onVerify={mockOnVerify}
        onChange={onChangeSpy}
      />
    );

    const verifyButton = screen.getByRole('button', { name: 'Verify' });
    fireEvent.click(verifyButton);

    await vi.runAllTimersAsync();

    rerender(
      <ApiKeyInput
        {...defaultProps}
        value="sk-or-v1-mysecretkey"
        status="valid"
        onVerify={mockOnVerify}
        onChange={onChangeSpy}
      />
    );

    expect(screen.getByText(/\(100ms\)/i)).toBeDefined();

    const input = screen.getByLabelText(/OpenRouter API Key/i);
    fireEvent.change(input, { target: { value: 'sk-or-v1-mysecretkey-new' } });

    expect(onChangeSpy).toHaveBeenCalledWith('sk-or-v1-mysecretkey-new');

    rerender(
      <ApiKeyInput
        {...defaultProps}
        value="sk-or-v1-mysecretkey-new"
        status="idle"
        onVerify={mockOnVerify}
        onChange={onChangeSpy}
      />
    );

    expect(screen.queryByText(/\(100ms\)/i)).toBeNull();
    expect(screen.queryByText(/Connection active/i)).toBeNull();

    vi.useRealTimers();
  });
});
