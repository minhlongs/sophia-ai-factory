import { emailOTP, twoFactor } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { escapeHtml } from '@/seed/security/input-sanitization-utilities';
import { sendSeedEmail } from '@/seed/email/email-sender';

/**
 * Extracts the WebAuthn Relying Party ID (hostname without port) from baseURL.
 * Ensures Passkeys work across localhost, preview URLs, and production domains.
 */
export function resolveRpId(baseURL: string): string {
  try {
    const parsed = new URL(baseURL);
    return parsed.hostname || 'localhost';
  } catch {
    return 'localhost';
  }
}

export function buildEmailOtpHtml(otp: string, type: string): string {
  const safeOtp = escapeHtml(otp.trim());
  const actionEn =
    type === 'forget-password'
      ? 'reset your password'
      : type === 'email-verification'
        ? 'verify your email address'
        : 'sign in to Sophia AI Factory';
  const actionVi =
    type === 'forget-password'
      ? 'đặt lại mật khẩu của bạn'
      : type === 'email-verification'
        ? 'xác thực địa chỉ email của bạn'
        : 'đăng nhập vào Sophia AI Factory';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#4338CA;margin-bottom:8px;">Sophia AI Factory — Security Code</h2>
  <p>Use the 6-digit verification code below to ${actionEn}. This code expires in <strong>5 minutes</strong>.</p>
  <div style="background:#F5F3FF;border:1px solid #DDD6FE;border-radius:12px;padding:18px 24px;text-align:center;margin:20px 0;">
    <span style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#312E81;">${safeOtp}</span>
  </div>
  <p style="font-size:13px;color:#666;">If you did not request this code, please ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
  <h3 style="color:#4338CA;margin-bottom:8px;">Mã xác thực 6 số — Sophia AI</h3>
  <p>Sử dụng mã 6 chữ số bên trên để ${actionVi}. Mã có hiệu lực trong <strong>5 phút</strong>.</p>
  <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.</p>
</body></html>`;
}

export function createPasskeyPlugin(baseURL: string) {
  const rpID = resolveRpId(baseURL);
  return passkey({
    rpID,
    rpName: 'Sophia AI Factory',
    origin: baseURL,
  });
}

export function createEmailOtpPlugin() {
  return emailOTP({
    otpLength: 6,
    expiresIn: 300,
    sendVerificationOTP: async ({ email, otp, type }) => {
      await sendSeedEmail({
        to: email,
        subject: `${otp} is your Sophia AI verification code · Mã xác thực Sophia AI`,
        html: buildEmailOtpHtml(otp, type),
      });
    },
  });
}

export function createTwoFactorPlugin() {
  return twoFactor({
    issuer: 'Sophia AI Factory',
  });
}
