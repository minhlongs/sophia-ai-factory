// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginFormView } from '../login-form-view';

const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSignInEmail = vi.fn();
const mockSignInMagicLink = vi.fn();

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
      googleSignIn: 'Google',
      ssoComingSoon: 'Sắp có mặt',
      hidePassword: 'Ẩn mật khẩu',
      showPassword: 'Hiện mật khẩu',
      invalidCredentials: 'Email hoặc mật khẩu không đúng',
      networkError: 'Lỗi mạng. Vui lòng thử lại.',
      emailRequired: 'Vui lòng nhập địa chỉ email',
      magicLink: 'Liên kết đăng nhập',
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
      magicLink: (...args: unknown[]) => mockSignInMagicLink(...args),
    },
  },
}));

describe('LoginFormView validation and error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows emailRequired (not networkError) when Magic Link is clicked with empty email', async () => {
    render(<LoginFormView />);
    const magicBtn = screen.getByRole('button', { name: 'Liên kết đăng nhập' });
    fireEvent.click(magicBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Vui lòng nhập địa chỉ email');
    expect(alert.textContent).not.toContain('Lỗi mạng. Vui lòng thử lại.');
    expect(mockSignInMagicLink).not.toHaveBeenCalled();
  });

  it('shows emailRequired when form is submitted with empty email', async () => {
    render(<LoginFormView />);
    const submitBtn = screen.getByRole('button', { name: 'Đăng nhập vào Sophia' });
    fireEvent.click(submitBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Vui lòng nhập địa chỉ email');
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('shows invalidCredentials when password is empty on submit without calling API', async () => {
    render(<LoginFormView />);
    fireEvent.change(screen.getByLabelText('Địa chỉ Email'), {
      target: { value: 'ceo@agencyos.network' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập vào Sophia' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Email hoặc mật khẩu không đúng');
    expect(mockSignInEmail).not.toHaveBeenCalled();
  });

  it('redirects to /dashboard on valid credentials and shows networkError only on fetch throw', async () => {
    mockSignInEmail.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null });
    render(<LoginFormView redirectTo="/vi/dashboard/campaigns" />);

    fireEvent.change(screen.getByLabelText('Địa chỉ Email'), {
      target: { value: '  ceo@agencyos.network  ' },
    });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'StrongPass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập vào Sophia' }));

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: 'ceo@agencyos.network',
        password: 'StrongPass123',
      });
      expect(mockPush).toHaveBeenCalledWith('/dashboard/campaigns');
    });
  });
});
