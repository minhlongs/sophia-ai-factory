/**
 * Bilingual Affiliate Invitation Email Copy & Formatting Helpers
 *
 * Layer: tree (pure deterministic domain logic)
 *
 * @module tree/email/templates/affiliate-invitation-helpers
 */

/**
 * Human-readable mapping of asset kit identifiers to localized display names
 */
export const ASSET_KIT_NAMES: Record<string, { en: string; vi: string }> = {
  brand_kit: {
    en: 'Brand Media Kit & Vector Logos',
    vi: 'Bộ nhận diện thương hiệu & Logo Vector',
  },
  video_scripts: {
    en: 'High-Converting Video Scripts & UGC Prompts',
    vi: 'Kịch bản video viral & Prompt UGC chuyển đổi cao',
  },
  email_swipes: {
    en: 'Email Swipe Copy & Social Media Templates',
    vi: 'Mẫu email bán hàng & Nội dung mạng xã hội',
  },
  demo_broll: {
    en: 'Product Demo B-Roll & Screen Recordings',
    vi: 'Video B-Roll trải nghiệm sản phẩm & Bản quay màn hình',
  },
};

export function normalizeAffiliateJoinUrl(joinUrl: string): string {
  if (!joinUrl.startsWith('https://') && !joinUrl.startsWith('http://localhost')) {
    return joinUrl.startsWith('http://')
      ? joinUrl.replace('http://', 'https://')
      : `https://sophia.agencyos.network${joinUrl.startsWith('/') ? '' : '/'}${joinUrl}`;
  }
  return joinUrl;
}

export interface AffiliatePlainTextInput {
  partnerName: string;
  customCommissionRatePct: number;
  safeJoinUrl: string;
  welcomeMessage?: string;
  enKitNames: string[];
  viKitNames: string[];
  expiresInDays: number;
}

export function buildAffiliateInvitationPlainText(input: AffiliatePlainTextInput): string {
  const {
    partnerName,
    customCommissionRatePct,
    safeJoinUrl,
    welcomeMessage,
    enKitNames,
    viKitNames,
    expiresInDays,
  } = input;

  return `
=== EXCLUSIVE INVITATION: SOPHIA AI FACTORY PARTNER PROGRAM ===

Hello ${partnerName},

You have been exclusively invited to become an official Sophia AI Factory Affiliate Partner with an exclusive ${customCommissionRatePct}% recurring commission on all subscriptions referred by you.

${welcomeMessage ? `Note from inviter: "${welcomeMessage.trim()}"\n\n` : ''}${
    enKitNames.length > 0 ? `Included Marketing Kits: ${enKitNames.join(', ')}\n\n` : ''
  }Accept your invitation and activate your partner credentials at:
${safeJoinUrl}

(This invitation link is valid for ${expiresInDays} days and can only be used once.)

--------------------------------------------------

=== THƯ MỜI THAM GIA ĐỐI TÁC ĐỘC QUYỀN SOPHIA AI FACTORY ===

Xin chào ${partnerName},

Bạn vừa nhận được lời mời độc quyền tham gia Mạng lưới Đối tác Liên kết Sophia AI Factory với mức hoa hồng định kỳ đặc biệt ${customCommissionRatePct}% trên mọi đơn hàng phát sinh từ đường dẫn của bạn.

${welcomeMessage ? `Lời nhắn từ người mời: "${welcomeMessage.trim()}"\n\n` : ''}${
    viKitNames.length > 0 ? `Bộ tài liệu tiếp thị đính kèm: ${viKitNames.join(', ')}\n\n` : ''
  }Chấp nhận lời mời và kích hoạt tài khoản đối tác của bạn tại:
${safeJoinUrl}

(Đường dẫn lời mời có hiệu lực trong ${expiresInDays} ngày và chỉ dùng một lần duy nhất.)
`.trim();
}
