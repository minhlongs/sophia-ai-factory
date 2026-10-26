// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResetPasswordFormView } from '../reset-password-form-view';

const mockSendOtp = vi.fn();
const mockResetPassword = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      email_label: 'Địa Chỉ Email',
      email_placeholder: 'ban@example.com',
      submit_request: 'Gửi Liên Kết Đặt Lại',
      submitting: 'Đang gửi...',
      token: 'Token',
      new_password_label: 'Mật Khẩu Mới',
      new_password_placeholder: 'Tối thiểu 8 ký tự',
      confirm_password_label: 'Xác Nhận Mật Khẩu',
      confirm_password_placeholder: 'Nhập lại mật khẩu',
      submit_confirm: 'Đặt Mật Khẩu',
      setting: 'Đang đặt...',
      confirm_success_title: 'Mật Khẩu Đã Cập Nhật',
      confirm_success_body: 'Mật khẩu của bạn đã được đặt.',
      sign_in_now: 'Đăng Nhập Ngay',
      back_to_login: 'Quay lại đăng nhập',
      error_token_missing: 'Token đặt lại không hợp lệ',
      error_password_mismatch: 'Mật khẩu không khớp.',
      error_password_too_short: 'Mật khẩu phải có ít nhất 8 ký tự.',
      error_generic: 'Đã xảy ra lỗi.',
    };
    return map[key] ?? key;
  },
}));

vi.mock('@/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/seed/auth/better-auth-client', () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: (...args: unknown[]) => mockSendOtp(...args),
      resetPassword: (...args: unknown[]) => mockResetPassword(...args),
    },
  },
}));

describe('ResetPasswordFormView Auth 2027 flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends forget-password OTP and transitions to step 2', async () => {
    mockSendOtp.mockResolvedValueOnce({ data: { success: true }, error: null });
    render(<ResetPasswordFormView />);

    fireEvent.change(screen.getByLabelText('Địa Chỉ Email'), {
      target: { value: 'founder@agencyos.network' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi Liên Kết Đặt Lại' }));

    await waitFor(() => {
      expect(mockSendOtp).toHaveBeenCalledWith({
        email: 'founder@agencyos.network',
        type: 'forget-password',
      });
      expect(screen.getByLabelText('Token')).toBeDefined();
    });
  });

  it('validates 6-digit OTP and password match before resetting password', async () => {
    mockSendOtp.mockResolvedValueOnce({ data: { success: true }, error: null });
    mockResetPassword.mockResolvedValueOnce({ data: { status: true }, error: null });

    render(<ResetPasswordFormView />);
    fireEvent.change(screen.getByLabelText('Địa Chỉ Email'), {
      target: { value: 'founder@agencyos.network' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi Liên Kết Đặt Lại' }));

    const otpInput = await screen.findByLabelText('Token');
    fireEvent.change(otpInput, { target: { value: '654321' } });
    fireEvent.change(screen.getByLabelText('Mật Khẩu Mới'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.change(screen.getByLabelText('Xác Nhận Mật Khẩu'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đặt Mật Khẩu' }));

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith({
        email: 'founder@agencyos.network',
        otp: '654321',
        password: 'StrongPass123',
      });
      expect(screen.getByText('Mật Khẩu Đã Cập Nhật')).toBeDefined();
    });
  });
});
