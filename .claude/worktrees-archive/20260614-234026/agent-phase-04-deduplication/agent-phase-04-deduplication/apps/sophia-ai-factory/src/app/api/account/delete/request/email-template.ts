/**
 * Bilingual EN/VI email template for account deletion confirmation.
 *
 * Wave 21 Phase 02: original implementation.
 * Wave 22 Phase 07: refactored to use the shared bilingual CTA template.
 *
 * @module app/api/account/delete/request/email-template
 */

import { buildBilingualCtaEmail } from '@/seed/email/bilingual-cta-template';

const ACCENT = '#dc2626';

export function buildDeleteConfirmHtml(rawUrl: string, cooldownDays: number): string {
  return buildBilingualCtaEmail({
    accentColor: ACCENT,
    cta: { url: rawUrl, bgColor: ACCENT },
    en: {
      heading: 'Confirm account deletion',
      paragraphs: [
        'You requested to permanently delete your Sophia AI Factory account.',
        `Click below to confirm. After confirmation, your account enters a ${cooldownDays}-day cooldown period during which you can cancel. After ${cooldownDays} days, all data will be permanently erased.`,
      ],
      ctaLabel: 'Confirm deletion',
      footer:
        'If you did not request this, ignore this email — your account is unchanged.',
    },
    vi: {
      heading: 'Xác nhận xoá tài khoản',
      paragraphs: [
        'Bạn vừa yêu cầu xoá vĩnh viễn tài khoản Sophia AI Factory.',
        `Nhấn nút phía trên để xác nhận. Sau khi xác nhận, tài khoản sẽ vào giai đoạn chờ ${cooldownDays} ngày — bạn có thể huỷ trong thời gian này. Sau ${cooldownDays} ngày, toàn bộ dữ liệu sẽ bị xoá vĩnh viễn.`,
      ],
      ctaLabel: 'Xác nhận xoá',
      footer:
        'Nếu bạn không yêu cầu, vui lòng bỏ qua — tài khoản không thay đổi.',
    },
  });
}
