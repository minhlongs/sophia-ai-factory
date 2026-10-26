// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginFormView } from '../login-form-view';
import { resolveRedirectTarget } from '../use-auth-2027-state';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSignInEmail = vi.fn();
const mockSignInPasskey = vi.fn();
const mockSendOtp = vi.fn();
const mockSignInOtp = vi.fn();

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      emailLabel: 'Địa chỉ Email',
      emailPlaceholder: 'ten@congty.com',
      passwordLabel: 'Mật khẩu',
      passwordPlaceholder: 'Nhập mật khẩu của bạn',
      forgotPassword: 'Quên mật khẩu?',
      submit: 'Đăng nhập vào Sophia',
      orContinueWith: 'hoặc tiếp tục với',
      noAccount: 'Chưa có tài khoản?',
      signUp: 'Đăng ký',
      passkeySignIn: 'Passkey (FaceID / TouchID)',
      emailOtpSend: 'Mã OTP 6 số',
      emailOtpLabel: 'Mã xác thực 6 chữ số',
      emailOtpPlaceholder: 'Nhập 6 chữ số từ email',
      emailOtpVerify: 'Xác thực OTP',
      emailOtpSentNotice: 'Đã gửi mã 6 chữ số đến email của bạn.',
      invalidOtp: 'Mã xác thực không hợp lệ hoặc đã hết hạn',
      hidePassword: 'Ẩn mật khẩu',
      showPassword: 'Hiện mật khẩu',
      invalidCredentials: 'Email hoặc mật khẩu không đúng',
      networkError: 'Lỗi mạng. Vui lòng thử lại.',
      emailRequired: 'Vui lòng nhập địa chỉ email',
      loading: 'Đang tải...',
      switchToEnglish: 'Chuyển sang Tiếng Anh',
    };
    return map[key] ?? key;
  },
  useLocale: () => 'vi',
}));

vi.mock('@/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/login',
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/seed/auth/better-auth-client', () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => mockSignInEmail(...args),
      passkey: (...args: unknown[]) => mockSignInPasskey(...args),
      emailOtp: (...args: unknown[]) => mockSignInOtp(...args),
    },
    emailOtp: {
      sendVerificationOtp: (...args: unknown[]) => mockSendOtp(...args),
    },
  },
}));

describe('LoginFormView Auth 2027 flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows emailRequired when sending OTP with empty email', async () => {
    render(<LoginFormView />);
    const otpBtn = screen.getByRole('button', { name: 'Mã OTP 6 số' });
    fireEvent.click(otpBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Vui lòng nhập địa chỉ email');
    expect(mockSendOtp).not.toHaveBeenCalled();
  });

  it('sends OTP and reveals OTP input panel when valid email is provided', async () => {
    mockSendOtp.mockResolvedValueOnce({ data: { success: true }, error: null });
    render(<LoginFormView />);

    fireEvent.change(screen.getByLabelText('Địa chỉ Email'), {
      target: { value: 'ceo@agencyos.network' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mã OTP 6 số' }));

    await waitFor(() => {
      expect(mockSendOtp).toHaveBeenCalledWith({
        email: 'ceo@agencyos.network',
        type: 'sign-in',
      });
      expect(screen.getByLabelText('Mã xác thực 6 chữ số')).toBeDefined();
    });
  });

  it('verifies 6-digit OTP code and redirects on success', async () => {
    mockSendOtp.mockResolvedValueOnce({ data: { success: true }, error: null });
    mockSignInOtp.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });

    render(<LoginFormView redirectTo="/vi/dashboard" />);
    fireEvent.change(screen.getByLabelText('Địa chỉ Email'), {
      target: { value: 'ceo@agencyos.network' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mã OTP 6 số' }));

    const otpInput = await screen.findByLabelText('Mã xác thực 6 chữ số');
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác thực OTP' }));

    await waitFor(() => {
      expect(mockSignInOtp).toHaveBeenCalledWith({
        email: 'ceo@agencyos.network',
        otp: '123456',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('triggers Passkey authentication and redirects on success', async () => {
    mockSignInPasskey.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    render(<LoginFormView />);

    const passkeyBtn = screen.getByRole('button', { name: 'Passkey (FaceID / TouchID)' });
    fireEvent.click(passkeyBtn);

    await waitFor(() => {
      expect(mockSignInPasskey).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows emailRequired when form is submitted with empty email', async () => {
    render(<LoginFormView />);
    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập vào Sophia' });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Vui lòng nhập địa chỉ email');
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  describe('resolveRedirectTarget open redirect defense', () => {
    it('allows clean relative paths and strips leading locale segment', () => {
      expect(resolveRedirectTarget('/vi/dashboard')).toBe('/dashboard');
      expect(resolveRedirectTarget('/en/campaigns')).toBe('/campaigns');
      expect(resolveRedirectTarget('/dashboard/settings')).toBe('/dashboard/settings');
    });

    it('rejects external protocol-relative URLs and falls back to /dashboard', () => {
      expect(resolveRedirectTarget('//evil.com/phish')).toBe('/dashboard');
      expect(resolveRedirectTarget('/\\evil.com/phish')).toBe('/dashboard');
      expect(resolveRedirectTarget('https://evil.com')).toBe('/dashboard');
      expect(resolveRedirectTarget('javascript:alert(1)')).toBe('/dashboard');
    });

    it('rejects /api/ internal routes and empty values', () => {
      expect(resolveRedirectTarget('/api/auth/sign-out')).toBe('/dashboard');
      expect(resolveRedirectTarget(undefined)).toBe('/dashboard');
      expect(resolveRedirectTarget('')).toBe('/dashboard');
    });
  });
});
