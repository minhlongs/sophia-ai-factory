import { magicLink } from 'better-auth/plugins';
import { escapeHtml } from '@/seed/security/input-sanitization-utilities';
import { sendSeedEmail } from '@/seed/email/email-sender';

export function buildWelcomeHtml(nameOrEmail: string): string {
  const raw = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail;
  const name = escapeHtml(raw);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Welcome to Sophia AI Factory!</h2>
  <p>Hi ${name},</p>
  <p>Your account is ready. Here's how to get started:</p>
  <ol>
    <li>Set up your API keys in <a href="https://sophia.agencyos.network/dashboard/onboarding" style="color:#6750A4;">Onboarding</a></li>
    <li>Create your first AI video campaign</li>
    <li>Connect Telegram bot @Sophia_Bbot for mobile access</li>
  </ol>
  <p>Need help? Reply to this email, open the live-chat bubble on <a href="https://sophia.agencyos.network" style="color:#6750A4;">sophia.agencyos.network</a>, or message @Sophia_Bbot on Telegram.</p>
  <p style="color:#444;">Cần hỗ trợ? Trả lời email này, mở ô chat ở góc phải trang web, hoặc nhắn @Sophia_Bbot trên Telegram.</p>
  <p style="font-size:13px;color:#666;">Sophia AI Factory — AI-powered video production platform</p>
</body></html>`;
}

export function buildMagicLinkHtml(rawUrl: string): string {
  // Sanitize URL to prevent XSS — only allow https URLs
  const url = rawUrl.startsWith('https://') || rawUrl.startsWith('http://localhost')
    ? rawUrl.replace(/"/g, '&quot;').replace(/</g, '&lt;')
    : '#';
  // Bilingual template: EN block + VI block. Subject mirrors both languages.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">
  <h2 style="color:#6750A4">Sign in to Sophia AI Factory</h2>
  <p>Click the button below to sign in. The link is valid for 15 minutes.</p>
  <a href="${url}" style="display:inline-block;background:#6750A4;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">Sign In · Đăng Nhập</a>
  <p style="font-size:13px;color:#666;">If you did not request this email, please ignore it.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
  <h3 style="color:#6750A4;margin-bottom:8px;">Đăng nhập Sophia AI</h3>
  <p>Nhấn nút bên trên để đăng nhập. Link có hiệu lực trong 15 phút.</p>
  <p style="font-size:13px;color:#666;">Nếu bạn không yêu cầu email này, vui lòng bỏ qua.</p>
</body></html>`;
}

export function createMagicLinkPlugin() {
  return magicLink({
    sendMagicLink: async ({ email, url }) => {
      await sendSeedEmail({
        to: email,
        subject: 'Sign in to Sophia AI Factory · Đăng nhập Sophia AI',
        html: buildMagicLinkHtml(url),
      });
    },
    expiresIn: 900,
  });
}
