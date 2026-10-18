/**
 * Bilingual Affiliate Invitation Email Template
 *
 * Implements bilingual EN + VI invitation email rendering using buildBilingualCtaEmail
 * from the seed layer. Includes custom commission rate, welcome note,
 * marketing kit attachments notice, and single-use redemption link.
 *
 * Layer: tree (pure deterministic domain logic)
 * Allowed imports: @/seed/*, @/tree/*
 *
 * @module tree/email/templates/affiliate-invitation
 */

import { buildBilingualCtaEmail } from '@/seed/email/bilingual-cta-template';
import {
  ASSET_KIT_NAMES,
  buildAffiliateInvitationPlainText,
  normalizeAffiliateJoinUrl,
} from './affiliate-invitation-helpers';

export interface AffiliateInvitationEmailParams {
  partnerName: string;
  customCommissionRatePct: number;
  joinUrl: string;
  welcomeMessage?: string;
  assetKits?: string[];
  expiresInDays?: number;
}

export interface RenderedAffiliateInvitationEmail {
  html: string;
  text: string;
  subject: string;
}

/**
 * Build bilingual EN+VI affiliate partner invitation email.
 */
export function buildAffiliateInvitationEmail(
  params: AffiliateInvitationEmailParams,
): RenderedAffiliateInvitationEmail {
  const {
    partnerName,
    customCommissionRatePct,
    joinUrl,
    welcomeMessage,
    assetKits = [],
    expiresInDays = 14,
  } = params;

  const safeJoinUrl = normalizeAffiliateJoinUrl(joinUrl);
  const enKitNames = assetKits.map((id) => ASSET_KIT_NAMES[id]?.en ?? id);
  const viKitNames = assetKits.map((id) => ASSET_KIT_NAMES[id]?.vi ?? id);

  const enParagraphs: string[] = [
    `Hello ${partnerName},`,
    `You have been exclusively invited to become an official Sophia AI Factory Affiliate Partner with an exclusive ${customCommissionRatePct}% recurring commission on all subscriptions referred by you.`,
  ];
  if (welcomeMessage && welcomeMessage.trim().length > 0) {
    enParagraphs.push(`Personal note from your inviter: "${welcomeMessage.trim()}"`);
  }
  if (enKitNames.length > 0) {
    enParagraphs.push(`Included Marketing Kits: ${enKitNames.join(', ')}.`);
  }
  enParagraphs.push(
    'Click the button below to accept your invitation, activate your partner credentials, and access your dedicated tracking link.',
  );

  const viParagraphs: string[] = [
    `Xin chào ${partnerName},`,
    `Bạn vừa nhận được lời mời độc quyền tham gia Mạng lưới Đối tác Liên kết Sophia AI Factory với mức hoa hồng định kỳ đặc biệt ${customCommissionRatePct}% trên mọi đơn hàng phát sinh từ đường dẫn của bạn.`,
  ];
  if (welcomeMessage && welcomeMessage.trim().length > 0) {
    viParagraphs.push(`Lời nhắn từ người mời: "${welcomeMessage.trim()}"`);
  }
  if (viKitNames.length > 0) {
    viParagraphs.push(`Bộ tài liệu tiếp thị đính kèm: ${viKitNames.join(', ')}.`);
  }
  viParagraphs.push(
    'Bấm vào nút bên dưới để chấp nhận lời mời, kích hoạt tài khoản đối tác và nhận đường dẫn giới thiệu chuyên biệt của bạn.',
  );

  const subject = 'Invitation to Join Sophia AI Factory Partner Program · Lời mời tham gia Đối tác Sophia AI';

  const html = buildBilingualCtaEmail({
    en: {
      heading: 'Exclusive Partner Invitation',
      paragraphs: enParagraphs,
      footer: `This invitation link is valid for ${expiresInDays} days and can only be used once. If you did not expect this invitation, you may safely disregard this message.`,
      ctaLabel: 'Accept Invitation',
    },
    vi: {
      heading: 'Thư Mời Tham Gia Đối Tác Độc Quyền',
      paragraphs: viParagraphs,
      footer: `Đường dẫn lời mời có hiệu lực trong ${expiresInDays} ngày và chỉ dùng một lần duy nhất. Nếu bạn không yêu cầu lời mời này, vui lòng bỏ qua thư.`,
      ctaLabel: 'Tham gia ngay',
    },
    accentColor: '#7c3aed',
    cta: {
      url: safeJoinUrl,
      bgColor: '#7c3aed',
    },
  });

  const text = buildAffiliateInvitationPlainText({
    partnerName,
    customCommissionRatePct,
    safeJoinUrl,
    welcomeMessage,
    enKitNames,
    viKitNames,
    expiresInDays,
  });

  return {
    subject,
    html,
    text,
  };
}

/**
 * Alias for template dispatcher compatibility
 */
export const renderAffiliateInvitation = buildAffiliateInvitationEmail;
