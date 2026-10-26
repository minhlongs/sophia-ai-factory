import { describe, it, expect, vi } from 'vitest';

const mockSendSeedEmail = vi.hoisted(() => vi.fn());

vi.mock('@/seed/email/email-sender', () => ({
  sendSeedEmail: mockSendSeedEmail,
}));

import {
  resolveRpId,
  buildEmailOtpHtml,
  createPasskeyPlugin,
  createEmailOtpPlugin,
  createTwoFactorPlugin,
} from '../passkey-and-otp-plugins';

describe('passkey-and-otp-plugins (Auth 2027)', () => {
  it('resolveRpId extracts hostname dynamically from baseURL and falls back to localhost', () => {
    expect(resolveRpId('https://sophia.agencyos.network')).toBe('sophia.agencyos.network');
    expect(resolveRpId('http://localhost:3000/api/auth')).toBe('localhost');
    expect(resolveRpId('invalid-url')).toBe('localhost');
  });

  it('buildEmailOtpHtml renders bilingual EN + VI HTML and sanitizes OTP input', () => {
    const html = buildEmailOtpHtml(' 482910 ', 'sign-in');
    expect(html).toContain('482910');
    expect(html).toContain('sign in to Sophia AI Factory');
    expect(html).toContain('đăng nhập vào Sophia AI Factory');
  });

  it('creates passkey, emailOTP, and twoFactor plugin configurations cleanly', () => {
    const pk = createPasskeyPlugin('https://sophia.agencyos.network');
    const otp = createEmailOtpPlugin();
    const mfa = createTwoFactorPlugin();

    expect(pk.id).toBe('passkey');
    expect(otp.id).toBe('email-otp');
    expect(mfa.id).toBe('two-factor');
  });
});
