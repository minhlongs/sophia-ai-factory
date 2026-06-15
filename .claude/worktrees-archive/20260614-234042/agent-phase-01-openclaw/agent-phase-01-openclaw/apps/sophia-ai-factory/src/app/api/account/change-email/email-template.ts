/**
 * Bilingual EN+VI email body for change-email confirmation flow.
 *
 * Wave 22 Phase 07: thin adapter over the shared bilingual CTA template.
 *
 * @module app/api/account/change-email/email-template
 */

import { buildBilingualCtaEmail } from '@/seed/email/bilingual-cta-template';

const ACCENT = '#6750A4';

export function buildChangeEmailHtml(
  rawUrl: string,
  oldEmail: string,
  newEmail: string,
): string {
  return buildBilingualCtaEmail({
    accentColor: ACCENT,
    cta: { url: rawUrl, bgColor: ACCENT },
    en: {
      heading: 'Confirm new email',
      paragraphs: [
        `You requested to change the email on your Sophia AI Factory account from ${oldEmail} to ${newEmail}.`,
        'Click the button below to confirm. The link is valid for 1 hour.',
      ],
      ctaLabel: 'Confirm new email',
      footer:
        'If you did not request this change, ignore this email — your account is unchanged.',
    },
    vi: {
      heading: 'Xác nhận email mới',
      paragraphs: [
        `Bạn vừa yêu cầu đổi email tài khoản Sophia AI từ ${oldEmail} sang ${newEmail}.`,
        'Nhấn nút phía trên để xác nhận. Link có hiệu lực trong 1 giờ.',
      ],
      ctaLabel: 'Xác nhận email mới',
      footer: 'Nếu bạn không yêu cầu, vui lòng bỏ qua — tài khoản không thay đổi.',
    },
  });
}
