/**
 * Shared email layout helpers — header, footer, button, locale.
 * Used by all templates to guarantee consistent styling.
 * @module lib/email/templates/shared-layout
 */

export const BRAND_COLOR = '#7c3aed';
export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://sophia.agencyos.network';
export const SUPPORT_EMAIL = 'support@mekongmind.com';
export const SENDER_FROM = process.env.EMAIL_FROM ?? 'Sophia AI <noreply@mekongmind.com>';

export function htmlWrapper(content: string, accentFrom = 'rgba(139,92,246,0.15)', accentTo = 'rgba(59,130,246,0.15)', borderColor = 'rgba(139,92,246,0.3)'): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sophia AI Factory</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:24px">
  <div style="max-width:560px;margin:0 auto">
    <div style="background:linear-gradient(135deg,${accentFrom},${accentTo});border:1px solid ${borderColor};border-radius:16px;padding:32px">
      ${brandHeader()}
      ${content}
      ${footer()}
    </div>
  </div>
</body>
</html>`;
}

function brandHeader(): string {
  return `<h1 style="font-size:24px;font-weight:700;margin:0 0 8px;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent">
    Sophia AI Factory
  </h1>
  <p style="color:#a1a1aa;margin:0 0 24px;font-size:14px">AI Video Factory Platform</p>`;
}

function footer(): string {
  return `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:24px 0">
  <p style="color:#a1a1aa;font-size:13px;margin:0">
    Support: <a href="mailto:${SUPPORT_EMAIL}" style="color:#a78bfa">${SUPPORT_EMAIL}</a>
  </p>`;
}

export function ctaButton(label: string, url: string, gradient = 'linear-gradient(135deg,#7c3aed,#2563eb)'): string {
  return `<a href="${url}"
     style="display:inline-block;background:${gradient};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:16px">
    ${label}
  </a>`;
}

export function magicLinkNote(locale: string): string {
  return locale.startsWith('vi')
    ? '<p style="color:#71717a;font-size:13px;margin:8px 0 24px">Link chỉ dùng 1 lần, hết hạn sau 24 giờ.</p>'
    : '<p style="color:#71717a;font-size:13px;margin:8px 0 24px">One-time use link, expires in 24 hours.</p>';
}

/** Convert HTML email to plain text fallback */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
