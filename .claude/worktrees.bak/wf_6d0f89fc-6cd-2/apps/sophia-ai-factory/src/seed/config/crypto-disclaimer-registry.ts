/**
 * crypto-disclaimer-registry.ts — Per-jurisdiction crypto disclaimer text
 *
 * Maps jurisdiction codes to regulatory-required disclosure text.
 * Text is IMMUTABLE per release — no user override permitted.
 *
 * Jurisdictions covered:
 *   US  — SEC / CFTC guidance (past performance warning)
 *   EU  — MiCA Article 7 (in force 2024-12)
 *   VN  — State Bank of Vietnam ban on crypto trading promotion
 *   SG  — MAS Notice PSN08 (DPT risk warning)
 *   JP  — FSA Registered Exchange Disclosure (金融庁)
 *
 * @module seed/config/crypto-disclaimer-registry
 */

/** Supported jurisdiction codes for crypto compliance. */
export const CRYPTO_JURISDICTIONS = ['US', 'EU', 'VN', 'SG', 'JP'] as const;

export type CryptoJurisdiction = typeof CRYPTO_JURISDICTIONS[number];

/** Short disclaimer per jurisdiction — for caption prepend (fits in most char limits). */
export interface CryptoDisclaimerShort {
  en: string;
  vi: string;
}

/** Full disclaimer per jurisdiction — for video overlay (15-second end card). */
export interface CryptoDisclaimerFull {
  en: string;
  vi: string;
}

export interface JurisdictionDisclaimer {
  code: CryptoJurisdiction;
  short: CryptoDisclaimerShort;
  full: CryptoDisclaimerFull;
  /** Whether crypto content is BLOCKED entirely in this jurisdiction. */
  blocked: boolean;
  /** Regulatory reference for audit trail. */
  regulatoryRef: string;
}

/**
 * Registry of per-jurisdiction crypto disclaimers.
 * Ordered by strictness (blocked first, then strictest).
 */
export const CRYPTO_DISCLAIMER_REGISTRY: Record<CryptoJurisdiction, JurisdictionDisclaimer> = {
  VN: {
    code: 'VN',
    blocked: true,
    regulatoryRef: 'State Bank of Vietnam — Decree 52/2024/ND-CP; crypto trading promotion prohibited',
    short: {
      en: '[BLOCKED: Crypto promotion is prohibited in Vietnam by law]',
      vi: '[BỊ CHẶN: Quảng bá tiền điện tử bị cấm tại Việt Nam theo pháp luật]',
    },
    full: {
      en: 'This content cannot be published to Vietnam-targeted channels. Promotion or advertising of cryptocurrency assets is prohibited under Vietnamese law (State Bank of Vietnam Decree 52/2024/ND-CP). Publishing this content to VN-targeted channels may result in legal liability.',
      vi: 'Nội dung này không thể được đăng lên các kênh nhắm mục tiêu đến Việt Nam. Việc quảng bá hoặc quảng cáo tài sản tiền điện tử bị cấm theo pháp luật Việt Nam (Ngân hàng Nhà nước — Nghị định 52/2024/NĐ-CP).',
    },
  },

  US: {
    code: 'US',
    blocked: false,
    regulatoryRef: 'SEC / CFTC — Past performance disclosure; FTC 16 C.F.R. § 255 affiliate disclosure',
    short: {
      en: '#ad | Crypto is highly volatile. Past performance does not guarantee future results. Not financial advice.',
      vi: '#ad | Tiền điện tử biến động cao. Kết quả quá khứ không đảm bảo tương lai. Không phải tư vấn tài chính.',
    },
    full: {
      en: 'DISCLOSURE: This content contains affiliate links. Cryptocurrencies are highly volatile and speculative assets. Past performance is not indicative of future results. This is not financial, investment, or legal advice. Investing in cryptocurrency involves significant risk of loss. Only invest what you can afford to lose. (SEC/CFTC guidance; FTC 16 C.F.R. § 255)',
      vi: 'CÔNG BỐ: Nội dung này có liên kết affiliate. Tiền điện tử là tài sản đầu cơ, biến động cao. Kết quả quá khứ không đảm bảo kết quả tương lai. Đây không phải là tư vấn tài chính, đầu tư hoặc pháp lý. Đầu tư vào tiền điện tử có rủi ro mất vốn đáng kể.',
    },
  },

  EU: {
    code: 'EU',
    blocked: false,
    regulatoryRef: 'MiCA Regulation (EU) 2023/1114 — Article 7 white-paper disclosure; in force 2024-12-30',
    short: {
      en: '#ad | Crypto-assets are speculative. Capital is at risk. Not financial advice. (MiCA EU 2023/1114)',
      vi: '#ad | Tài sản tiền điện tử mang tính đầu cơ. Vốn có thể bị mất. Không phải tư vấn tài chính. (MiCA EU)',
    },
    full: {
      en: 'DISCLOSURE: This content contains affiliate links. Crypto-assets are highly speculative instruments. The value of crypto-assets can fluctuate significantly and investors may lose all capital invested. This content does not constitute financial advice or an offer to buy/sell crypto-assets. Issued in compliance with MiCA Regulation (EU) 2023/1114, Article 7.',
      vi: 'CÔNG BỐ: Nội dung này có liên kết affiliate. Tài sản tiền điện tử là công cụ đầu cơ cao. Giá trị có thể biến động mạnh và nhà đầu tư có thể mất toàn bộ vốn. Nội dung này không cấu thành tư vấn tài chính. Tuân thủ Quy định MiCA (EU) 2023/1114, Điều 7.',
    },
  },

  SG: {
    code: 'SG',
    blocked: false,
    regulatoryRef: 'MAS Notice PSN08 — Digital Payment Token (DPT) service risk warnings (effective 2022-01-28)',
    short: {
      en: '#ad | DPT (crypto) is high-risk and may not suit retail investors. (MAS Notice PSN08)',
      vi: '#ad | Tiền điện tử rủi ro cao, có thể không phù hợp với nhà đầu tư cá nhân. (MAS PSN08)',
    },
    full: {
      en: 'DISCLOSURE: This content contains affiliate links related to Digital Payment Token (DPT) services. DPTs are not legal tender in Singapore. The value of DPTs may fluctuate greatly and may be subject to regulatory restrictions. Please assess the risks carefully. This is not financial advice. (Monetary Authority of Singapore Notice PSN08)',
      vi: 'CÔNG BỐ: Nội dung này có liên kết affiliate liên quan đến dịch vụ Mã thông báo thanh toán kỹ thuật số (DPT). DPT không phải là tiền hợp pháp tại Singapore. Giá trị DPT có thể biến động lớn. Vui lòng đánh giá rủi ro cẩn thận. Đây không phải tư vấn tài chính. (MAS Notice PSN08)',
    },
  },

  JP: {
    code: 'JP',
    blocked: false,
    regulatoryRef: 'FSA Japan — Financial Instruments and Exchange Act; registered crypto exchange disclosure (暗号資産交換業者)',
    short: {
      en: '#ad | Crypto trading involves risk of loss. Use only FSA-registered exchanges in Japan. (FSA JP)',
      vi: '#ad | Giao dịch tiền điện tử có rủi ro mất vốn. Chỉ sử dụng sàn giao dịch đã đăng ký FSA tại Nhật Bản.',
    },
    full: {
      en: 'DISCLOSURE: This content contains affiliate links. Cryptocurrency trading involves significant risk of loss. In Japan, cryptocurrency exchange services must be registered with the Financial Services Agency (FSA) under the Payment Services Act. Please confirm the exchange is FSA-registered before trading. This is not financial advice. (金融庁 / Financial Services Agency Japan)',
      vi: 'CÔNG BỐ: Nội dung này có liên kết affiliate. Giao dịch tiền điện tử có rủi ro mất vốn đáng kể. Tại Nhật Bản, dịch vụ sàn giao dịch tiền điện tử phải được đăng ký với Cơ quan Dịch vụ Tài chính (FSA). Hãy xác nhận sàn giao dịch đã đăng ký FSA trước khi giao dịch. Đây không phải tư vấn tài chính.',
    },
  },
};

/**
 * Retrieve disclaimer for a jurisdiction.
 * Falls back to US (most common, well-known strictness) if unknown code provided.
 */
export function getDisclaimerForJurisdiction(
  jurisdiction: string,
): JurisdictionDisclaimer {
  const key = jurisdiction.toUpperCase() as CryptoJurisdiction;
  return CRYPTO_DISCLAIMER_REGISTRY[key] ?? CRYPTO_DISCLAIMER_REGISTRY['US'];
}

/**
 * Return true if crypto content is blocked in this jurisdiction.
 */
export function isCryptoBlockedInJurisdiction(jurisdiction: string): boolean {
  return getDisclaimerForJurisdiction(jurisdiction).blocked;
}
