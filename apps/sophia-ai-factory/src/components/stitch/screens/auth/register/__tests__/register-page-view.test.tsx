// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterPageView } from '../register-page-view';

const mockSignUpEmail = vi.fn();
const mockSendOtp = vi.fn();
const mockSignInOtp = vi.fn();
const mockSignInPasskey = vi.fn();
const mockAddPasskey = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: 'Tạo tài khoản của bạn',
      subtitle: 'Bắt đầu hành trình doanh thu tự động',
      companyLabel: 'Tên công ty',
      companyPlaceholder: 'Công ty của bạn',
      emailLabel: 'Địa chỉ Email',
      emailPlaceholder: 'ten@congty.com',
      passwordLabel: 'Tạo mật khẩu',
      passwordPlaceholder: 'Tạo mật khẩu mạnh',
      confirmPasswordLabel: 'Xác nhận mật khẩu',
      confirmPasswordPlaceholder: 'Nhập lại mật khẩu',
      termsPrefix: 'Khi tạo tài khoản, bạn đồng ý với',
      termsLink: 'Điều khoản dịch vụ',
      and: 'Và',
      privacyLink: 'Chính sách bảo mật',
      submit: 'Tạo tài khoản',
      or: 'Hoặc',
      hasAccount: 'Đã có tài khoản?',
      signIn: 'Đăng nhập',
      passkeySignIn: 'Passkey (FaceID / TouchID)',
      emailOtpSend: 'Mã OTP 6 số',
      emailOtpLabel: 'Mã xác thực 6 chữ số',
      emailOtpPlaceholder: 'Nhập 6 chữ số từ email',
      emailOtpVerify: 'Xác thực OTP',
      emailOtpSentNotice: 'Đã gửi mã 6 chữ số đến email của bạn.',
      invalidOtp: 'Mã xác thực không hợp lệ',
      emailRequired: 'Vui lòng nhập địa chỉ email',
      successTitle: 'Tạo tài khoản thành công!',
      successMessage: 'Chào mừng bạn đến với Sophia AI Factory.',
      startSetup: 'Bắt đầu thiết lập hệ thống',
      goToLogin: 'Đăng nhập tài khoản',
    };
    return map[key] ?? key;
  },
  useLocale: () => 'vi',
}));

vi.mock('@/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/register',
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/seed/auth/better-auth-client', () => ({
  authClient: {
    signUp: {
      email: (...args: unknown[]) => mockSignUpEmail(...args),
    },
    signIn: {
      emailOtp: (...args: unknown[]) => mockSignInOtp(...args),
      passkey: (...args: unknown[]) => mockSignInPasskey(...args),
    },
    emailOtp: {
      sendVerificationOtp: (...args: unknown[]) => mockSendOtp(...args),
    },
    passkey: {
      addPasskey: (...args: unknown[]) => mockAddPasskey(...args),
    },
  },
}));

describe('RegisterPageView Auth 2027 flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('supports passwordless registration via 6-digit Email OTP', async () => {
    mockSendOtp.mockResolvedValueOnce({ data: { success: true }, error: null });
    mockSignInOtp.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });

    render(<RegisterPageView />);
    fireEvent.change(screen.getByLabelText(/Địa chỉ Email/i), {
      target: { value: 'newceo@agencyos.network' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mã OTP 6 số' }));

    const otpInput = await screen.findByLabelText('Mã xác thực 6 chữ số');
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));

    await waitFor(() => {
      expect(mockSendOtp).toHaveBeenCalledWith({
        email: 'newceo@agencyos.network',
        type: 'sign-in',
      });
      expect(mockSignInOtp).toHaveBeenCalledWith({
        email: 'newceo@agencyos.network',
        otp: '123456',
      });
      expect(screen.getByText('Tạo tài khoản thành công!')).toBeDefined();
    });
  });

  it('offers Passkey enrollment on success screen', async () => {
    mockSignInPasskey.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    mockAddPasskey.mockResolvedValueOnce({ data: { id: 'pk1' }, error: null });

    render(<RegisterPageView />);
    fireEvent.click(screen.getByRole('button', { name: 'Passkey (FaceID / TouchID)' }));

    await waitFor(() => {
      expect(screen.getByText('Tạo tài khoản thành công!')).toBeDefined();
    });

    const enrollBtn = screen.getByRole('button', { name: /Passkey/i });
    fireEvent.click(enrollBtn);
    await waitFor(() => {
      expect(mockAddPasskey).toHaveBeenCalledWith({ name: 'Sophia AI Device' });
    });
  });
});
