/**
 * Tier upgrade email template — refactored from handover-email-service.ts.
 * @module lib/email/templates/tier-upgrade
 */

import type { Tier } from '@/seed/types';
import { htmlWrapper, ctaButton, htmlToText, BASE_URL } from './shared-layout';

export interface TierUpgradeData {
  ownerFullName: string;
  newTier: Tier;
  locale: string;
}

export function renderTierUpgrade(data: TierUpgradeData): { html: string; text: string; subject: string } {
  const isVi = data.locale.startsWith('vi');
  const name = data.ownerFullName;

  const subject = isVi
    ? `Bạn đã nâng cấp lên gói ${data.newTier} — Sophia AI`
    : `You've upgraded to ${data.newTier} — Sophia AI`;

  const greeting = isVi ? `Xin chào ${name},` : `Hello ${name},`;
  const body = isVi
    ? `Tài khoản của bạn đã được nâng cấp lên gói <strong>${data.newTier}</strong>. Các tính năng mới đã được kích hoạt ngay lập tức.`
    : `Your account has been upgraded to the <strong>${data.newTier}</strong> plan. New features are unlocked immediately.`;
  const ctaLabel = isVi ? 'Xem Dashboard' : 'Go to Dashboard';

  const content = `
    <p style="margin:0 0 16px">${greeting}</p>
    <p style="margin:0 0 24px;line-height:1.6">${body}</p>
    ${ctaButton(ctaLabel, `${BASE_URL}/dashboard`, 'linear-gradient(135deg,#d97706,#7c3aed)')}`;

  const html = htmlWrapper(
    content,
    'rgba(245,158,11,0.12)',
    'rgba(139,92,246,0.12)',
    'rgba(245,158,11,0.3)',
  );
  return { html, text: htmlToText(html), subject };
}
