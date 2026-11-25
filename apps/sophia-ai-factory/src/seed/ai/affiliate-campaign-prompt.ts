/**
 * Affiliate Campaign Studio AI Prompt, Parser, Validator & Compliance Enforcer.
 *
 * Pure seed-layer primitives (zero DB/tree/land imports):
 * - Builds structured OpenRouter prompts for Crypto & SaaS affiliate campaigns.
 * - Parses and validates complete AffiliateCampaignPack JSON.
 * - Enforces exact token-boundary customer referral URL preservation and rejects unauthorized foreign URLs.
 * - Rejects misleading/guaranteed crypto return claims across all text AND scene visual descriptions.
 * - Injects immutable jurisdiction-appropriate affiliate + financial disclosures.
 * - Provides an explicitly labeled deterministic stub ONLY for automated E2E/fixture tests.
 *
 * @module seed/ai/affiliate-campaign-prompt
 */

import { getDisclaimerForJurisdiction } from '@/seed/config/crypto-disclaimer-registry';
import {
  InvalidScriptStructureError,
  parseScriptJsonFromLlm,
  validateParsedScriptStructure,
} from './script-generator-helpers';
import type { ScriptOutput } from './script-prompt-builders';

export type AffiliateStudioVertical = 'crypto' | 'saas';

export interface AffiliateOfferBrief {
  readonly vertical: AffiliateStudioVertical;
  readonly productName: string;
  readonly officialWebsiteUrl: string;
  readonly referralUrl: string;
  readonly commissionTerms: string;
  readonly targetAudience: string;
  readonly targetMarket: string;
  readonly productInfoSource: string;
}

export interface AffiliateCampaignPack {
  readonly campaignTitle: string;
  readonly audienceAnalysis: string;
  readonly valueProposition: string;
  readonly contentAngles: readonly string[];
  readonly hook: string;
  readonly callToAction: string;
  readonly shortFormScript: ScriptOutput;
  readonly socialPost: string;
  readonly affiliateDisclosure: string;
  readonly referralUrl: string;
}

const PROHIBITED_CRYPTO_CLAIMS: readonly RegExp[] = [
  /\bguaranteed\s+(?:profit|profits|returns|income|yield|gains)\b/i,
  /\brisk[-\s]?free\s+(?:profit|returns|crypto|yield|investment)\b/i,
  /\b100%\s+(?:win\s*rate|safe|guaranteed)\b/i,
  /cam\s*kết\s*(?:lợi\s*nhuận|lãi|x\d+|nhân\s*tài\s*sản)/i,
  /lợi\s*nhuận\s*đảm\s*bảo/i,
  /chắc\s*chắn\s*(?:lãi|thắng|sinh\s*lời)/i,
  /không\s*rủi\s*ro/i,
];

const URL_TOKEN_RE = /https?:\/\/[^\s)>\]"']+/gi;

export function containsProhibitedCryptoClaim(text: string): boolean {
  return PROHIBITED_CRYPTO_CLAIMS.some((pattern) => pattern.test(text));
}

export function extractUrlTokens(text: string): string[] {
  const matches = text.match(URL_TOKEN_RE) ?? [];
  return matches.map((m) => m.replace(/[.,;:!?]+$/, ''));
}

function getHostnameLower(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function hasExactReferralUrlToken(text: string, expectedReferralUrl: string): boolean {
  return extractUrlTokens(text).some((token) => token === expectedReferralUrl);
}

export function assertNoForeignAffiliateUrls(
  text: string,
  expectedReferralUrl: string,
  officialWebsiteUrl?: string,
): void {
  const allowedHosts = new Set(
    [getHostnameLower(expectedReferralUrl), officialWebsiteUrl ? getHostnameLower(officialWebsiteUrl) : ''].filter(
      Boolean,
    ),
  );
  for (const token of extractUrlTokens(text)) {
    if (token === expectedReferralUrl) continue;
    if (officialWebsiteUrl && token.replace(/\/+$/, '') === officialWebsiteUrl.replace(/\/+$/, '')) {
      continue;
    }
    const tokenHost = getHostnameLower(token);
    if (!allowedHosts.has(tokenHost)) {
      throw new InvalidScriptStructureError(
        `Campaign pack rejected: unauthorized third-party URL detected (${tokenHost || token}). Only your verified referral link is permitted.`,
      );
    }
    if (tokenHost === getHostnameLower(expectedReferralUrl) && token !== expectedReferralUrl) {
      throw new InvalidScriptStructureError(
        'Campaign pack rejected: modified or spoofed referral URL detected. Referral link must match character-for-character.',
      );
    }
  }
}

export function buildMandatoryAffiliateDisclosure(
  vertical: AffiliateStudioVertical,
  targetMarket: string,
  locale: 'vi' | 'en' = 'vi',
): string {
  if (vertical === 'crypto') {
    const disclaimer = getDisclaimerForJurisdiction(targetMarket);
    return disclaimer.full[locale];
  }
  return locale === 'vi'
    ? '#QuảngCáo | Nội dung này có chứa liên kết giới thiệu (affiliate). Nếu bạn đăng ký hoặc mua qua liên kết của chúng tôi, chúng tôi có thể nhận hoa hồng mà bạn không mất thêm bất kỳ chi phí nào.'
    : '#ad | This content contains an affiliate referral link. If you sign up or purchase through this link, we may earn a commission at no extra cost to you.';
}

export const AFFILIATE_CAMPAIGN_SYSTEM_PROMPT = `You are a commercial Affiliate Marketing Strategist for SaaS and Crypto products.
Strict commercial & regulatory rules:
1. Use ONLY factual product details and commission terms supplied by the user — never invent discounts, bonuses, APY, or commission percentages.
2. NEVER promise guaranteed profits, risk-free crypto returns, or misleading financial claims.
3. Preserve the exact customer referral link verbatim in the CTA and social post — never shorten, rewrite, append parameters, or include any other URL.
4. Always include clear affiliate disclosure (and crypto risk disclosure when vertical is crypto).
5. Return ONLY valid JSON matching the requested schema.`;

export function buildAffiliateCampaignUserPrompt(
  offer: AffiliateOfferBrief,
  durationSec: number,
  locale: 'vi' | 'en' = 'vi',
): string {
  const safeDuration = Math.max(15, Math.min(180, Math.round(durationSec || 30)));
  const minDur = Math.ceil(Math.max(10, safeDuration * 0.5));
  const maxDur = Math.floor(safeDuration * 1.5);
  const langInstruction =
    locale === 'vi'
      ? 'Write all campaign text in natural, persuasive business Vietnamese (keep URLs exact).'
      : 'Write all campaign text in clear, persuasive business English (keep URLs exact).';

  return `${langInstruction}

Affiliate Offer Brief:
- Vertical: ${offer.vertical === 'crypto' ? 'Crypto Affiliate (Regulated — zero profit guarantees)' : 'SaaS Affiliate'}
- Product Name: ${offer.productName}
- Official Website: ${offer.officialWebsiteUrl}
- Customer Verified Referral Link (MUST appear verbatim, no other URLs allowed): ${offer.referralUrl}
- Commission Terms (for campaign positioning context — do NOT fabricate bonuses): ${offer.commissionTerms}
- Target Audience: ${offer.targetAudience}
- Target Market / Jurisdiction: ${offer.targetMarket}
- Product Information Source: ${offer.productInfoSource}

Generate a complete Affiliate Campaign Pack as JSON with this exact shape:
{
  "campaignTitle": "string",
  "audienceAnalysis": "string (pain points, buying triggers, objections)",
  "valueProposition": "string (concrete problem solved without hype)",
  "contentAngles": ["angle 1", "angle 2", "angle 3"],
  "hook": "string (first 3-second attention hook)",
  "callToAction": "string (must include ${offer.referralUrl})",
  "shortFormScript": {
    "title": "string",
    "total_duration": ${safeDuration},
    "scenes": [
      {
        "scene_number": 1,
        "title": "Hook",
        "visual_description": "string",
        "narration": "string",
        "duration_estimate": 8
      }
    ]
  },
  "socialPost": "string (ready-to-post caption including ${offer.referralUrl})",
  "affiliateDisclosure": "string",
  "referralUrl": "${offer.referralUrl}"
}

Constraints:
- shortFormScript must have 3 to 5 scenes and total_duration between ${minDur} and ${maxDur} seconds.
- Include ${offer.referralUrl} verbatim in callToAction and socialPost, and include NO third-party links.`;
}

function readNonEmptyString(obj: Record<string, unknown>, key: string, maxLen = 4000): string {
  const raw = obj[key];
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new InvalidScriptStructureError(`Missing or empty campaign field: ${key}`);
  }
  return raw.trim().slice(0, maxLen);
}

export function normalizeAndValidateCampaignPack(
  rawInput: unknown,
  opts: {
    readonly expectedReferralUrl: string;
    readonly officialWebsiteUrl?: string;
    readonly vertical: AffiliateStudioVertical;
    readonly targetMarket: string;
    readonly targetDurationSec?: number;
    readonly locale?: 'vi' | 'en';
  },
): AffiliateCampaignPack {
  const parsed =
    typeof rawInput === 'string' ? (parseScriptJsonFromLlm(rawInput) as unknown) : rawInput;
  if (!parsed || typeof parsed !== 'object') {
    throw new InvalidScriptStructureError('Campaign pack must be a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  const referralUrl = opts.expectedReferralUrl.trim();
  if (!referralUrl) {
    throw new InvalidScriptStructureError('Expected referralUrl is required');
  }

  const campaignTitle = readNonEmptyString(obj, 'campaignTitle', 240);
  const audienceAnalysis = readNonEmptyString(obj, 'audienceAnalysis', 2500);
  const valueProposition = readNonEmptyString(obj, 'valueProposition', 2000);
  const hook = readNonEmptyString(obj, 'hook', 600);
  const rawCta = readNonEmptyString(obj, 'callToAction', 1000);
  const rawSocial = readNonEmptyString(obj, 'socialPost', 4000);

  const rawAngles = Array.isArray(obj.contentAngles) ? obj.contentAngles : [];
  const contentAngles = rawAngles
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, 400))
    .slice(0, 6);
  if (contentAngles.length < 2) {
    throw new InvalidScriptStructureError('contentAngles must contain at least 2 angles');
  }

  const shortFormScript = validateParsedScriptStructure(obj.shortFormScript, {
    minScenes: 3,
    targetDurationSec: opts.targetDurationSec,
  });

  const urlScanSurface = [
    rawCta,
    rawSocial,
    ...shortFormScript.scenes.map((s) => `${s.visual_description} ${s.narration}`),
  ].join(' ');
  assertNoForeignAffiliateUrls(urlScanSurface, referralUrl, opts.officialWebsiteUrl);

  const callToAction = hasExactReferralUrlToken(rawCta, referralUrl)
    ? rawCta
    : `${rawCta} — ${referralUrl}`;

  const locale = opts.locale ?? 'vi';
  const affiliateDisclosure = buildMandatoryAffiliateDisclosure(
    opts.vertical,
    opts.targetMarket,
    locale,
  );

  let socialPost = hasExactReferralUrlToken(rawSocial, referralUrl)
    ? rawSocial
    : `${rawSocial}\n\n👉 ${referralUrl}`;

  if (opts.vertical === 'crypto') {
    // Crypto campaigns MUST carry the immutable regulatory risk disclosure verbatim — bare #ad never suffices
    if (!socialPost.includes(affiliateDisclosure)) {
      socialPost = `${socialPost}\n\n${affiliateDisclosure}`;
    }
  } else if (!socialPost.includes('#ad') && !socialPost.includes('#QuảngCáo')) {
    socialPost = `${socialPost}\n\n${affiliateDisclosure}`;
  }

  if (opts.vertical === 'crypto') {
    const combinedText = [
      campaignTitle,
      audienceAnalysis,
      valueProposition,
      ...contentAngles,
      hook,
      callToAction,
      socialPost,
      shortFormScript.title,
      ...shortFormScript.scenes.map(
        (s) => `${s.title ?? ''} ${s.visual_description} ${s.narration}`,
      ),
    ].join(' ');
    if (containsProhibitedCryptoClaim(combinedText)) {
      throw new InvalidScriptStructureError(
        'Crypto campaign rejected: prohibited guaranteed-profit or risk-free return claim detected.',
      );
    }
  }

  return {
    campaignTitle,
    audienceAnalysis,
    valueProposition,
    contentAngles,
    hook,
    callToAction,
    shortFormScript,
    socialPost,
    affiliateDisclosure,
    referralUrl,
  };
}

export function buildSimulatedAffiliateCampaignPack(
  offer: AffiliateOfferBrief,
  durationSec: number,
  locale: 'vi' | 'en' = 'vi',
): AffiliateCampaignPack {
  const safeDuration = Math.max(15, Math.min(180, Math.round(durationSec || 30)));
  const s1 = Math.max(5, Math.round(safeDuration * 0.25));
  const s2 = Math.max(5, Math.round(safeDuration * 0.45));
  const s3 = Math.max(5, safeDuration - s1 - s2);
  const disclosure = buildMandatoryAffiliateDisclosure(offer.vertical, offer.targetMarket, locale);

  return {
    campaignTitle: `[SIMULATED STUB] ${offer.productName} — ${offer.targetMarket}`,
    audienceAnalysis: `[Simulated Stub] Target segment: ${offer.targetAudience} in ${offer.targetMarket}. Primary focus: practical workflow value backed by ${offer.productInfoSource}.`,
    valueProposition: `[Simulated Stub] ${offer.productName} (${offer.officialWebsiteUrl}) helps ${offer.targetAudience} evaluate a transparent workflow without exaggerated claims.`,
    contentAngles: [
      `Problem-to-workflow walkthrough for ${offer.targetAudience}`,
      `Transparent feature breakdown sourced from ${offer.productInfoSource}`,
      `Step-by-step onboarding checklist with official referral link`,
    ],
    hook: `[Simulated Hook] Still comparing options for ${offer.productName}? Check these 3 facts before you sign up.`,
    callToAction: `Explore ${offer.productName} via our official partner link: ${offer.referralUrl}`,
    shortFormScript: {
      title: `[SIMULATED STUB] ${offer.productName} Short-Form Review`,
      total_duration: s1 + s2 + s3,
      scenes: [
        {
          scene_number: 1,
          title: 'Hook',
          duration_estimate: s1,
          visual_description: `Clean product overview screen of ${offer.productName}`,
          narration: `Before choosing a tool in ${offer.targetMarket}, see how ${offer.productName} actually works for ${offer.targetAudience}.`,
        },
        {
          scene_number: 2,
          title: 'Core Value',
          duration_estimate: s2,
          visual_description: `Feature walkthrough referencing ${offer.officialWebsiteUrl}`,
          narration: `Based on ${offer.productInfoSource}, ${offer.productName} focuses on clear operational steps rather than hype.`,
        },
        {
          scene_number: 3,
          title: 'Disclosure & Referral CTA',
          duration_estimate: s3,
          visual_description: `End card displaying disclosure and referral link`,
          narration: `Check full details and partner disclosure at ${offer.referralUrl}.`,
        },
      ],
    },
    socialPost: `[SIMULATED STUB] Practical breakdown of ${offer.productName} for ${offer.targetAudience} (${offer.targetMarket}).\n\n👉 ${offer.referralUrl}\n\n${disclosure}`,
    affiliateDisclosure: disclosure,
    referralUrl: offer.referralUrl,
  };
}

export function renderAffiliateCampaignMarkdown(args: {
  readonly campaignId: string;
  readonly orgId: string;
  readonly version: number;
  readonly provenance: 'fixture_simulated' | 'live_provider';
  readonly provenanceLabel: string;
  readonly reviewState: string;
  readonly offer: AffiliateOfferBrief;
  readonly pack: AffiliateCampaignPack;
}): string {
  const { pack, offer } = args;
  const lines: string[] = [
    `# ${pack.campaignTitle}`,
    '',
    `- **Campaign ID:** ${args.campaignId}`,
    `- **Organization ID:** ${args.orgId}`,
    `- **Version:** v${args.version}`,
    `- **Provenance:** ${args.provenance} (${args.provenanceLabel})`,
    `- **Review State:** ${args.reviewState}`,
    `- **Vertical:** ${offer.vertical.toUpperCase()}`,
    `- **Product:** ${offer.productName} (${offer.officialWebsiteUrl})`,
    `- **Target Market:** ${offer.targetMarket}`,
    `- **Commission Terms:** ${offer.commissionTerms}`,
    `- **Product Source:** ${offer.productInfoSource}`,
    `- **Verified Referral Link:** ${pack.referralUrl}`,
    '',
    '## 1. Audience Analysis',
    pack.audienceAnalysis,
    '',
    '## 2. Value Proposition',
    pack.valueProposition,
    '',
    '## 3. Content Angles',
    ...pack.contentAngles.map((angle, idx) => `${idx + 1}. ${angle}`),
    '',
    '## 4. Hook & Call To Action',
    `- **Hook:** ${pack.hook}`,
    `- **CTA:** ${pack.callToAction}`,
    '',
    `## 5. Short-Form Video Script (${pack.shortFormScript.total_duration}s)`,
    `### ${pack.shortFormScript.title}`,
    '',
  ];

  for (const scene of pack.shortFormScript.scenes) {
    const label = scene.title ? `: ${scene.title}` : '';
    lines.push(`#### Scene ${scene.scene_number}${label} (${scene.duration_estimate}s)`);
    lines.push(`- **Visual:** ${scene.visual_description}`);
    lines.push(`- **Narration:** ${scene.narration}`);
    lines.push('');
  }

  lines.push('## 6. Ready-to-Post Social Copy (Manual Publish)');
  lines.push(pack.socialPost);
  lines.push('');
  lines.push('## 7. Mandatory Affiliate & Regulatory Disclosure');
  lines.push(pack.affiliateDisclosure);
  lines.push('');

  return lines.join('\n');
}
