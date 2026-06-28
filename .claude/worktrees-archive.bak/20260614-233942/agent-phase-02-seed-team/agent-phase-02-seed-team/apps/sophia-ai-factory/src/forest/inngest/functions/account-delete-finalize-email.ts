/**
 * Bilingual EN/VI deletion-complete notification email.
 *
 * Wave 22 Phase 06: thin adapter over the shared bilingual CTA template.
 * No CTA button — purely informational (one-way notification).
 *
 * @module forest/inngest/functions/account-delete-finalize-email
 */

import { buildBilingualCtaEmail } from '@/seed/email/bilingual-cta-template';

const ACCENT = '#dc2626';

export function buildDeletionCompleteHtml(): string {
  return buildBilingualCtaEmail({
    accentColor: ACCENT,
    en: {
      heading: 'Sophia AI account deleted',
      paragraphs: [
        'Your Sophia AI Factory account has been permanently deleted.',
        'All data associated with your account has been erased.',
      ],
      footer: 'If you did not request this, please contact support immediately.',
    },
    vi: {
      heading: 'Tài khoản Sophia AI đã xoá',
      paragraphs: [
        'Tài khoản Sophia AI Factory của bạn đã bị xoá vĩnh viễn.',
        'Toàn bộ dữ liệu liên quan đã được xoá khỏi hệ thống.',
      ],
      footer:
        'Nếu bạn không yêu cầu thao tác này, vui lòng liên hệ bộ phận hỗ trợ ngay lập tức.',
    },
  });
}
