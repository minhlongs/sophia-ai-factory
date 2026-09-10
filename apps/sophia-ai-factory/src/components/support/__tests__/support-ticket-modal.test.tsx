import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SupportTicketModal } from '../support-ticket-modal';

describe('SupportTicketModal', () => {
  const mockOnClose = vi.fn();
  const mockOnCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/support/tickets' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ticket: { id: 't-123', status: 'open' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ tickets: [] }),
      });
    });
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SupportTicketModal isOpen={false} onClose={mockOnClose} locale="vi" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with bilingual title and fields when open', () => {
    render(
      <SupportTicketModal isOpen={true} onClose={mockOnClose} locale="vi" />
    );
    expect(screen.getByText('Hỗ trợ Khách hàng')).toBeDefined();
    expect(screen.getByText('Tạo Ticket mới')).toBeDefined();
  });

  it('validates description min length before submission', async () => {
    render(
      <SupportTicketModal isOpen={true} onClose={mockOnClose} locale="vi" />
    );

    const descInput = screen.getByPlaceholderText('Mô tả chi tiết những gì bạn gặp phải...');
    fireEvent.change(descInput, { target: { value: 'short' } });

    const submitBtn = screen.getByRole('button', { name: /Gửi Ticket/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText('Mô tả cần ít nhất 10 ký tự.')).toBeDefined();
  });

  it('submits ticket successfully when valid input provided', async () => {
    render(
      <SupportTicketModal isOpen={true} onClose={mockOnClose} locale="en" onTicketCreated={mockOnCreated} />
    );

    const titleInput = screen.getByPlaceholderText('E.g., fal.ai connection timeout...');
    const descInput = screen.getByPlaceholderText('Describe what happened, error message, or steps to reproduce...');

    fireEvent.change(titleInput, { target: { value: 'Image generation failure' } });
    fireEvent.change(descInput, { target: { value: 'Fal.ai timed out after waiting 60 seconds on batch job.' } });

    // The form submit button has data-testid="button-submit-ticket"
    const submitBtn = screen.getByTestId('button-submit-ticket');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Ticket submitted successfully!')).toBeDefined();
      expect(mockOnCreated).toHaveBeenCalledTimes(1);
    });
  });
});
