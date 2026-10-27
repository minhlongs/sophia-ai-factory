/**
 * Niche Video Command Parser & Telegram Reply Formatter
 *
 * Layer: tree (domain reusable logic)
 * @module tree/telegram/niche-video-command-parser
 */

export interface NicheTelegramCommandResult {
  ok: boolean;
  niche?: 'saas_global' | 'crypto_global';
  productName?: string;
  jurisdiction?: string;
  draftPendingApproval?: boolean;
  error?: string;
}

const CRYPTO_KEYWORDS = [
  'binance',
  'bybit',
  'okx',
  'coinbase',
  'crypto',
  'bitcoin',
  'trade',
  'futures',
];

const KNOWN_JURISDICTIONS = new Set(['US', 'EU', 'JP', 'VN', 'SG', 'GLOBAL']);

export const NICHE_VIDEO_HELP_MESSAGE =
  '🎬 *Hướng dẫn tạo Video Chuyển Đổi Cao:*\n\n' +
  '• `/saas_video <tên hoặc link>`: Tạo video SaaS MRR 20-40%\n' +
  '• `/crypto_video <sàn hoặc link> [US|EU|JP]`: Tạo video Crypto Fee Rebate + Bonus\n' +
  '• `/niche_video <link>`: Tự động phân tích sản phẩm và tạo video\n\n' +
  'Ví dụ: `/saas_video linear.app` hoặc `/crypto_video binance.com US`';

export function parseNicheVideoCommand(
  command: string,
  args: string,
): {
  niche: 'saas_global' | 'crypto_global';
  blueprintId: string;
  productName: string;
  productUrl: string;
  jurisdiction: string;
} {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  let jurisdiction = 'GLOBAL';
  if (tokens.length > 1) {
    const lastToken = tokens[tokens.length - 1].toUpperCase();
    if (KNOWN_JURISDICTIONS.has(lastToken)) {
      jurisdiction = lastToken;
      tokens.pop();
    }
  }
  const trimmed = tokens.join(' ').trim();
  const lower = trimmed.toLowerCase();

  let isCrypto = command === '/crypto_video';
  if (!isCrypto && command === '/niche_video') {
    isCrypto = CRYPTO_KEYWORDS.some((kw) => lower.includes(kw));
  }

  const niche = isCrypto ? 'crypto_global' : 'saas_global';
  const blueprintId = isCrypto
    ? 'crypto_fee_discount_signup_bonus'
    : 'saas_problem_agitation_solution';

  let productUrl = trimmed;
  let productName = trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      productName = parsed.hostname.replace(/^www\./, '').split('.')[0];
      productName = productName.charAt(0).toUpperCase() + productName.slice(1);
    } catch {
      productName = trimmed;
    }
  } else {
    productUrl = `https://${trimmed.toLowerCase().replace(/\s+/g, '')}.com`;
  }

  return { niche, blueprintId, productName, productUrl, jurisdiction };
}

export function formatNicheDispatchedMessage(
  niche: 'saas_global' | 'crypto_global',
  productName: string,
  productUrl: string,
  options?: { draftPendingApproval?: boolean; jurisdiction?: string },
): string {
  const nicheLabel =
    niche === 'crypto_global'
      ? '🪙 Crypto Global (Fee Discount)'
      : '🚀 SaaS Global (Recurring MRR)';
  const complianceBadge =
    niche === 'crypto_global'
      ? '⚖️ MiCA & SEC 15s End-Card'
      : '⚖️ FTC 16 C.F.R. § 255';
  const draftNotice = options?.draftPendingApproval
    ? `\n🔒 *Chế độ Bản nháp (Chờ CEO duyệt):* Thị trường \`${options.jurisdiction ?? 'GLOBAL'}\` chưa xác định cụ thể (US/EU/JP). Kịch bản đã được tạo nháp, chờ CEO xác nhận thị trường và phê duyệt trước khi render/đăng bài.`
    : '';

  return (
    `✅ *Khởi tạo Video Chiến dịch Thành Công!*\n\n` +
    `📦 *Sản phẩm:* \`${productName}\`\n` +
    `🏷️ *Phân khúc:* ${nicheLabel}\n` +
    `🛡️ *Tuân thủ:* ${complianceBadge}\n` +
    `📊 *Tracking:* \`${productUrl}\`${draftNotice}\n\n` +
    `⏳ Hệ thống đang sinh kịch bản chi tiết, tạo voiceover ElevenLabs và xuất manifest render 9:16.\n` +
    `Gõ /status để kiểm tra tiến độ.`
  );
}
