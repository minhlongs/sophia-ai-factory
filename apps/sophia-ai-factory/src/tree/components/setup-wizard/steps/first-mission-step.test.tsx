import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstMissionStep } from './first-mission-step';

describe('FirstMissionStep', () => {
  it('renders title, CEO questions, and quick concepts in bilingual format', () => {
    render(
      <FirstMissionStep
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByText(/How Sophia Runs Your First Mission/i)).toBeDefined();
    expect(screen.getByText(/Quy trình khởi tạo an toàn/i)).toBeDefined();
    expect(screen.getByText(/1. WHAT DO I ENTER\? \/ Tôi cần nhập gì\?/i)).toBeDefined();
    expect(screen.getByText(/2. WHAT WILL SOPHIA DO\? \/ Sophia sẽ làm gì\?/i)).toBeDefined();
    expect(screen.getByText(/3. HOW LONG WILL IT TAKE\? \/ Mất bao lâu\?/i)).toBeDefined();
    expect(screen.getByText(/4. WHAT WILL IT COST\? \/ Chi phí bao nhiêu\?/i)).toBeDefined();
    expect(screen.getByText(/5. WHERE WILL RESULT APPEAR\? \/ Kết quả ở đâu\?/i)).toBeDefined();
    expect(screen.getByText(/Popular Mission Ideas \/ Ý tưởng chiến dịch phổ biến/i)).toBeDefined();
  });

  it('triggers onNext and onBack callbacks', () => {
    const onNext = vi.fn();
    const onBack = vi.fn();

    render(
      <FirstMissionStep
        onNext={onNext}
        onBack={onBack}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Quay lại/i }));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Tiếp tục/i }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('displays error message when saveError is provided', () => {
    render(
      <FirstMissionStep
        onNext={vi.fn()}
        onBack={vi.fn()}
        saveError="Encryption verification failure"
      />
    );

    expect(screen.getByText('Encryption verification failure')).toBeDefined();
  });

  it('disables buttons during isSaving state', () => {
    render(
      <FirstMissionStep
        onNext={vi.fn()}
        onBack={vi.fn()}
        isSaving={true}
      />
    );

    expect(screen.getByText(/Đang lưu \/ Saving/i)).toBeDefined();
    const nextButton = screen.getByRole('button', { name: /Đang lưu \/ Saving/i });
    expect(nextButton).toHaveProperty('disabled', true);
  });
});
