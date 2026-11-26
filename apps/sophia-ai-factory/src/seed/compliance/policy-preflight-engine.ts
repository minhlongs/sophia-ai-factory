/**
 * Sophia Policy-as-Code Compliance & Pre-flight Sanitization Engine.
 *
 * Proactively normalizes scripts and metadata BEFORE hitting third-party AI
 * providers (HeyGen, OpenRouter, D-ID), social platforms (TikTok, YouTube,
 * Instagram/Facebook), or regional regulators (US FTC, UK FCA, EU MiCA, VN, SG MAS).
 *
 * Layer: seed/compliance (pure deterministic rules, zero DB/network/external deps)
 *
 * @module seed/compliance/policy-preflight-engine
 */

export type ComplianceJurisdiction = 'US' | 'UK' | 'EU' | 'VN' | 'SG' | 'GLOBAL';
export type CompliancePlatform = 'tiktok' | 'youtube_shorts' | 'instagram_reels' | 'facebook_reels' | 'generic';
export type ComplianceProvider = 'heygen' | 'openrouter_tts' | 'did' | 'browser_mp4';
export type ComplianceVertical = 'crypto' | 'saas';

export interface PolicyPreflightInput {
  readonly text: string;
  readonly jurisdiction?: ComplianceJurisdiction;
  readonly platform?: CompliancePlatform;
  readonly provider?: ComplianceProvider;
  readonly vertical?: ComplianceVertical;
  readonly maxChars?: number;
}

export interface PolicyPreflightResult {
  readonly sanitizedText: string;
  readonly replacedCount: number;
  readonly appliedRules: readonly string[];
  readonly requiredDisclosure: string;
  readonly warnings: readonly string[];
  readonly exceedsMaxChars: boolean;
}

interface SanitizationRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly replacement: string;
  readonly providers?: readonly ComplianceProvider[];
  readonly platforms?: readonly CompliancePlatform[];
  readonly jurisdictions?: readonly ComplianceJurisdiction[];
}

const SANITIZATION_RULES: readonly SanitizationRule[] = [
  // Universal anti-scam / guaranteed-return rules (FTC, FCA, MiCA, VN, TikTok, HeyGen)
  {
    id: 'UNIVERSAL_GUARANTEED_PROFIT',
    pattern: /\b(?:guaranteed\s+(?:profit|profits|returns|income|yield|gains)|risk[-\s]?free\s+(?:profit|returns|crypto|yield|investment)|get\s+rich\s+quick|100%\s+(?:win\s*rate|safe|guaranteed))\b/gi,
    replacement: 'practical workflow advantage',
  },
  {
    id: 'VN_GUARANTEED_PROFIT',
    pattern: /kiếm\s*tiền\s*nhanh|lợi\s*nhuận\s*(?:khủng|đảm\s*bảo)|cam\s*kết\s*(?:lợi\s*nhuận|lãi|x\d+|nhân\s*tài\s*sản)|chắc\s*chắn\s*(?:lãi|thắng|sinh\s*lời)|x\d+\s*tài\s*khoản|kéo\s*1-1/gi,
    replacement: 'tối ưu hiệu suất công việc',
  },
  // UK FCA & SG MAS promotional inducement rules (ban sign-up bonus / free crypto retail inducements)
  {
    id: 'FCA_MAS_INDUCEMENT',
    pattern: /\b(?:free\s+crypto|sign[-\s]?up\s+bonus|trade\s+crypto\s+now|buy\s+btc\s+here)\b/gi,
    replacement: 'explore software tools',
    jurisdictions: ['UK', 'SG'],
  },
  // HeyGen & TikTok strict financial/forex/crypto moderation triggers
  {
    id: 'PROVIDER_FINANCIAL_MODERATION_EN',
    pattern: /\b(?:forex|binary\s+options|margin\s+trading|leverage\s+trading|crypto\s+trading|crypto\s+signal)\b/gi,
    replacement: 'digital market analysis',
    providers: ['heygen', 'did'],
    platforms: ['tiktok'],
  },
  {
    id: 'PROVIDER_BROKER_MODERATION_EN',
    pattern: /\b(?:broker|trading\s+platform)\b/gi,
    replacement: 'analytics platform',
    providers: ['heygen', 'did'],
  },
  {
    id: 'PROVIDER_CRYPTO_MODERATION_EN',
    pattern: /\b(?:crypto|cryptocurrency)\b/gi,
    replacement: 'Web3 software',
    providers: ['heygen', 'did'],
  },
  {
    id: 'PROVIDER_FINANCIAL_MODERATION_VN',
    pattern: /sàn\s*(?:giao\s*dịch|forex|nhị\s*phân)|đầu\s*tư\s*sinh\s*lời/gi,
    replacement: 'nền tảng công cụ số',
    providers: ['heygen', 'did'],
    platforms: ['tiktok'],
  },
];

const JURISDICTION_DISCLOSURES: Record<ComplianceJurisdiction, string> = {
  US: '#ad Affiliate Disclosure: We may earn a commission at no extra cost to you. Not financial advice.',
  UK: '#ad Affiliate link. Cryptoassets are high-risk; do not invest unless prepared to lose all invested money (FCA).',
  EU: '#ad Affiliate disclosure. Digital assets are volatile and not capital-protected (MiCA).',
  VN: '#QuảngCáo Liên kết tiếp thị (Affiliate). Nội dung chia sẻ công cụ, không phải lời khuyên đầu tư.',
  SG: '#ad Affiliate disclosure. Educational software review only; not an offer of DPT services (MAS).',
  GLOBAL: '#ad Affiliate Disclosure: Educational software review. Not financial advice.',
};

function ruleApplies(rule: SanitizationRule, input: PolicyPreflightInput): boolean {
  const hasScope = Boolean(rule.providers || rule.platforms || rule.jurisdictions);
  if (!hasScope) return true;

  if (rule.providers && input.provider && rule.providers.includes(input.provider)) {
    return true;
  }
  if (rule.platforms && input.platform && rule.platforms.includes(input.platform)) {
    return true;
  }
  if (rule.jurisdictions && input.jurisdiction && rule.jurisdictions.includes(input.jurisdiction)) {
    return true;
  }
  return false;
}

export function runPolicyPreflight(input: PolicyPreflightInput): PolicyPreflightResult {
  const jurisdiction: ComplianceJurisdiction = input.jurisdiction ?? 'GLOBAL';
  let sanitizedText = input.text.trim();
  let replacedCount = 0;
  const appliedRules: string[] = [];
  const warnings: string[] = [];

  for (const rule of SANITIZATION_RULES) {
    if (!ruleApplies(rule, input)) continue;
    let matchedInRule = false;
    sanitizedText = sanitizedText.replace(rule.pattern, () => {
      replacedCount += 1;
      matchedInRule = true;
      return rule.replacement;
    });
    if (matchedInRule) {
      appliedRules.push(rule.id);
    }
  }

  if (input.vertical === 'crypto' && (jurisdiction === 'UK' || jurisdiction === 'SG')) {
    warnings.push(`STRICT_CRYPTO_JURISDICTION_${jurisdiction}: Retail crypto promotion requires mandatory risk warning.`);
  }

  const exceedsMaxChars = typeof input.maxChars === 'number' && sanitizedText.length > input.maxChars;
  if (exceedsMaxChars) {
    warnings.push(`TEXT_EXCEEDS_MAX_CHARS:${sanitizedText.length}>${input.maxChars}`);
  }

  return {
    sanitizedText,
    replacedCount,
    appliedRules,
    requiredDisclosure: JURISDICTION_DISCLOSURES[jurisdiction],
    warnings,
    exceedsMaxChars,
  };
}
