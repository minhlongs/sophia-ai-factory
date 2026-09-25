/**
 * Unified Viral Metadata Generator
 *
 * Generates psychological hook titles, SEO descriptions, curated trending hashtags,
 * tracked conversion URLs, and CTR-maximizing thumbnail prompts for:
 * - Platforms: YouTube Shorts, TikTok, Instagram Reels, Facebook Reels
 * - Languages: Vietnamese (VI), English (EN), Japanese (JA), Korean (KO), Thai (TH)
 *
 * Layer: Tree (pure domain logic & template algorithms, no side effects)
 * Dependencies: imports only seed
 *
 * @module tree/publishing/viral-metadata-generator
 */

import type {
  ApacLanguage,
  ApacMarket,
  PlatformType,
  ThumbnailPromptSpec,
  ViralHookArchetype,
  ViralMetadataInput,
  ViralMetadataResult,
} from '@/seed/types/apac-syndication';

// ─── Character Limits & Platform Constraints ────────────────────────────────

export const PLATFORM_LIMITS: Record<PlatformType, { maxTitleLength: number; maxDescriptionLength: number }> = {
  youtube_shorts: { maxTitleLength: 100, maxDescriptionLength: 5000 },
  tiktok: { maxTitleLength: 150, maxDescriptionLength: 2200 },
  instagram_reels: { maxTitleLength: 150, maxDescriptionLength: 2200 },
  facebook_reels: { maxTitleLength: 150, maxDescriptionLength: 2200 },
};

// ─── Multilingual Psychological Hook Templates ──────────────────────────────

type HookTemplateMap = Record<ViralHookArchetype, (topic: string) => string>;

const HOOK_TEMPLATES_BY_LANGUAGE: Record<ApacLanguage, HookTemplateMap> = {
  vi: {
    curiosity_gap: (t) => `Bí Mật Đằng Sau ${t} Mà 99% Người Không Hề Biết`,
    shock_stat: (t) => `93% Thất Bại Với ${t} — Trừ Khi Bạn Biết Điều Này!`,
    direct_question: (t) => `Bạn Đang Lãng Phí 4 Giờ Mỗi Ngày Vì Bỏ Qua ${t}?`,
    problem_solution: (t) => `Cách Tự Động Hóa ${t} Trong 5 Phút Cực Đơn Giản`,
    contrarian: (t) => `Đừng Làm ${t} Theo Cách Cũ Nữa: Đây Là Xu Hướng 2026`,
  },
  en: {
    curiosity_gap: (t) => `The Hidden Secret About ${t} 99% Of People Don't Know`,
    shock_stat: (t) => `93% Fail At ${t} — Unless They Use This Exact Blueprint`,
    direct_question: (t) => `Are You Still Wasting 4 Hours A Day Ignoring ${t}?`,
    problem_solution: (t) => `How To Automate ${t} In 5 Minutes (Step-By-Step)`,
    contrarian: (t) => `Stop Doing ${t} The Old Way: The 2026 AI Framework`,
  },
  ja: {
    curiosity_gap: (t) => `99%が知らない【${t}】の驚愕の真実とは？`,
    shock_stat: (t) => `【衝撃】93%が挫折する${t}を完全攻略する裏ワザ`,
    direct_question: (t) => `まだ${t}で毎日3時間も無駄にしていませんか？`,
    problem_solution: (t) => `たった5分で自動化！プロが教える${t}実践術`,
    contrarian: (t) => `昔のやり方は今すぐ捨てろ！2026年最新の${t}攻略法`,
  },
  ko: {
    curiosity_gap: (t) => `99%가 전혀 모르는 ${t}의 숨겨진 진실`,
    shock_stat: (t) => `93%가 실패하는 ${t}, 이 공식 하나로 완벽 해결!`,
    direct_question: (t) => `아직도 ${t} 때문에 매일 3시간씩 낭비하고 계신가요?`,
    problem_solution: (t) => `단 5분 만에 끝내는 ${t} 자동화 실전 가이드`,
    contrarian: (t) => `${t} 더 이상 옛날 방식으로 하지 마세요 (2026 최신 AI)`,
  },
  th: {
    curiosity_gap: (t) => `ความลับของ ${t} ที่คน 99% ยังไม่เคยรู้`,
    shock_stat: (t) => `93% ล้มเหลวกับ ${t} ถ้าไม่ใช้วิธีนี้เด็ดขาด!`,
    direct_question: (t) => `คุณยังเสียเวลา 4 ชั่วโมงต่อวันกับ ${t} อยู่หรือเปล่า?`,
    problem_solution: (t) => `วิธีเปลี่ยน ${t} ให้เป็นระบบอัตโนมัติใน 5 นาที`,
    contrarian: (t) => `หยุดทำ ${t} แบบเดิมๆ ได้แล้ว — นี่คือเทคนิคใหม่ปี 2026`,
  },
};

// ─── Multilingual Trending Hashtags ─────────────────────────────────────────

const NICHE_HASHTAGS_BY_LANGUAGE: Record<ApacLanguage, Record<string, string[]>> = {
  vi: {
    ai_automation: ['#CongNgheAI', '#TuDongHoa', '#TriTueNhanTao', '#KinhDoanhOnline', '#KhoiNghiepAI'],
    ecommerce: ['#KinhDoanhOnline', '#ThuongMaiDienTu', '#BanHangOnline', '#ShopOnline', '#TikTokShop'],
    solopreneur: ['#SoloFounder', '#KinhDoanhTuDo', '#KiemTienOnline', '#TuDoTaiChinh', '#HocLamGiau'],
    default: ['#SophiaAI', '#XuHuong', '#KienThucMoi', '#CongNgheMoi', '#PhatTrienBanThan'],
  },
  en: {
    ai_automation: ['#AIAutomation', '#ArtificialIntelligence', '#TechTrends', '#ProductivityHacks', '#WorkflowAutomation'],
    ecommerce: ['#EcommerceTips', '#ShopifySuccess', '#OnlineBusiness', '#DropShipping', '#TikTokMadeMeBuyIt'],
    solopreneur: ['#Solopreneur', '#SideHustle', '#CreatorEconomy', '#PassiveIncome', '#StartupLife'],
    default: ['#SophiaAIFactory', '#TechInnovation', '#LearnOnTikTok', '#LifeHacks', '#ViralVideo'],
  },
  ja: {
    ai_automation: ['#AIツール', '#業務効率化', '#ChatGPT活用', '#自動化', '#最新テクノロジー'],
    ecommerce: ['#ネットショップ', '#ECビジネス', '#物販ビジネス', '#D2C', '#売上アップ'],
    solopreneur: ['#ひとり起業', '#副業初心者', '#不労所得', '#在宅ワーク', '#フリーランス'],
    default: ['#SophiaAI', '#ビジネス', '#自己啓発', '#仕事術', '#トレンド'],
  },
  ko: {
    ai_automation: ['#AI자동화', '#인공지능툴', '#스마트워크', '#생산성향상', '#테크트렌드'],
    ecommerce: ['#이커머스', '#온라인쇼핑몰', '#스마트스토어', '#매출상승', '#디지털노마드'],
    solopreneur: ['#1인기업', '#부업추천', '#수익창출', '#경제적자유', '#자기계발'],
    default: ['#SophiaAI', '#쇼츠추천', '#비즈니스팁', '#꿀팁공유', '#핫이슈'],
  },
  th: {
    ai_automation: ['#ปัญญาประดิษฐ์', '#ระบบอัตโนมัติ', '#เทคโนโลยีใหม่', '#เพิ่มยอดขาย', '#เครื่องมือAI'],
    ecommerce: ['#ขายของออนไลน์', '#ธุรกิจออนไลน์', '#เปิดร้านออนไลน์', '#การตลาดออนไลน์', '#TikTokShopครีเอเตอร์'],
    solopreneur: ['#สร้างรายได้ออนไลน์', '#อาชีพอิสระ', '#หารายได้เสริม', '#ฟรีแลนซ์', '#อิสรภาพทางการเงิน'],
    default: ['#SophiaAI', '#คลิปไวรัล', '#ความรู้ดีๆ', '#ฮาวทู', '#เทรนด์วันนี้'],
  },
};

const PLATFORM_SIGNATURE_TAGS: Record<PlatformType, string[]> = {
  youtube_shorts: ['#Shorts', '#YouTubeShorts'],
  tiktok: ['#FYP', '#ViralVideo', '#ForYou'],
  instagram_reels: ['#ReelsInstagram', '#ReelsViral', '#InstaReels'],
  facebook_reels: ['#FBReels', '#ReelsFacebook', '#VideoTrending'],
};

// ─── Tracking Link Builders ─────────────────────────────────────────────────

export function buildTrackedFunnelUrl(params: {
  baseUrl?: string;
  platform: PlatformType;
  niche: string;
  hookArchetype: ViralHookArchetype;
  videoId: string;
  referralCode?: string;
}): string {
  const {
    baseUrl = 'https://sophia.agencyos.network',
    platform,
    niche,
    hookArchetype,
    videoId,
    referralCode,
  } = params;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', platform);
    url.searchParams.set('utm_medium', 'short_video');
    url.searchParams.set('utm_campaign', niche.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    url.searchParams.set('utm_content', `${hookArchetype}_${videoId}`);

    if (referralCode && referralCode.trim().length > 0) {
      url.searchParams.set('ref', referralCode.trim());
    }

    return url.toString();
  } catch {
    const query = `utm_source=${platform}&utm_medium=short_video&utm_campaign=${encodeURIComponent(niche)}&utm_content=${hookArchetype}_${videoId}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ''}`;
    return `${baseUrl}?${query}`;
  }
}

export function buildTelegramDeepLink(params: {
  botUsername?: string;
  videoId: string;
  platform: PlatformType;
  niche: string;
  referralCode?: string;
  customStart?: string;
}): string {
  const {
    botUsername = 'Sophia_Bbot',
    videoId,
    platform,
    niche,
    referralCode,
    customStart,
  } = params;

  if (customStart && customStart.trim().length > 0) {
    return `https://t.me/${botUsername}?start=${encodeURIComponent(customStart.trim())}`;
  }

  const platformCodeMap: Record<PlatformType, string> = {
    youtube_shorts: 'yt',
    tiktok: 'tt',
    instagram_reels: 'ig',
    facebook_reels: 'fb',
  };

  const code = platformCodeMap[platform] ?? 'so';
  const cleanId = videoId.replace(/^vid_/, '').slice(0, 16);
  const cleanNiche = niche.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '');

  const payload = referralCode
    ? `v_${cleanId}_${code}_${referralCode.slice(0, 16)}`
    : `v_${cleanId}_${code}_${cleanNiche}`;

  const sanitized = payload.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64);
  return `https://t.me/${botUsername}?start=${sanitized}`;
}

// ─── Thumbnail Prompt Specification Generator ───────────────────────────────

export function generateThumbnailPromptSpec(params: {
  topic: string;
  language: ApacLanguage;
  platform: PlatformType;
  hookHeadline: string;
}): ThumbnailPromptSpec {
  const { topic, language, hookHeadline } = params;

  // Short 3-5 word headline for visual thumbnail badge
  const words = hookHeadline.split(/\s+/);
  const headlineBadge = words.length > 5 ? words.slice(0, 5).join(' ') + '...' : hookHeadline;

  const colorPalette = [
    '#00F0FF (Electric Cyan)',
    '#FF0055 (Neon Magenta)',
    '#FFE600 (High-Contrast Cyber Amber)',
    '#0D0E15 (Deep Pitch Midnight)',
  ];

  const prompt = [
    `Hyper-detailed YouTube Shorts/TikTok 9:16 mobile thumbnail background for viral video about "${topic}".`,
    `Focal Point: Dynamic ultra-realistic human specialist with intense shocked expression, pointing towards glowing holographic AI interface displaying explosive growth metrics.`,
    `Typography & Layout: High-contrast upper third header area reserved for bold 3D sans-serif Vietnamese/English headline text: "${headlineBadge}".`,
    `Color & Lighting: Neon cyan and vivid magenta rim lighting, cinematic dramatic volumetric backlight, crisp sharp details, 8k resolution, photorealistic Unreal Engine 5 render, mobile-first CTR design.`,
    `No cluttered small text, high readability at 120px scale on mobile screen.`,
  ].join(' ');

  return {
    aspectRatio: '9:16',
    layout: 'Mobile-first vertical 9:16, bold upper-third typography, high-contrast focal subject with rim glow',
    headlineText: headlineBadge,
    colorPalette,
    visualFocus: `Shocked expert subject + glowing futuristic holographic dashboard representing ${topic}`,
    lighting: 'Dramatic cinematic rim lighting (electric cyan & neon magenta) with deep dark contrast',
    prompt,
  };
}

// ─── Multilingual CTA Copy ──────────────────────────────────────────────────

export const CTA_COPY_BY_LANGUAGE: Record<ApacLanguage, { fun: string; tg: string; tagHeader: string }> = {
  vi: {
    fun: '🚀 Khám phá giải pháp tự động hóa video AI cùng Sophia Factory:',
    tg: '💬 Nhận video mẫu miễn phí & tư vấn tức thì qua Telegram Bot:',
    tagHeader: 'Từ khóa:',
  },
  en: {
    fun: '🚀 Deploy your 24/7 autonomous video agent with Sophia Factory:',
    tg: '💬 Test live interactive video demo on Telegram:',
    tagHeader: 'Tags:',
  },
  ja: {
    fun: '🚀 Sophia AI Factoryで動画制作を24時間完全自動化:',
    tg: '💬 Telegramで今すぐ無料デモ動画を体験:',
    tagHeader: '関連タグ:',
  },
  ko: {
    fun: '🚀 Sophia AI Factory로 24시간 자동화 비디오 파이프라인 구축:',
    tg: '💬 텔레그램 봇으로 실시간 무료 샘플 영상 받아보기:',
    tagHeader: '태그:',
  },
  th: {
    fun: '🚀 สร้างระบบผลิตวิดีโอ AI อัตโนมัติ 24 ชม. กับ Sophia Factory:',
    tg: '💬 ทดลองรับตัวอย่างวิดีโอฟรีผ่าน Telegram Bot ทันที:',
    tagHeader: 'แท็ก:',
  },
};

// ─── Platform-Compliant SEO Description Formatter ──────────────────────────

export interface FormatSeoDescriptionOptions {
  platform: PlatformType;
  language: ApacLanguage;
  rawTitle: string;
  keyTakeaways?: string[];
  trackedFunnelUrl: string;
  telegramDeepLink: string;
  hashtags: string[];
  referralCode?: string;
  maxDescriptionLength?: number;
}

/**
 * Helper to prune secondary elements (hashtags, referral notes) when the attribution
 * block itself is exceptionally close to or exceeds maxDescriptionLength.
 * GUARANTEE: trackedFunnelUrl and telegramDeepLink are 100% preserved.
 */
function pruneAttributionBlock(
  parts: string[],
  trackedFunnelUrl: string,
  telegramDeepLink: string,
  maxDescriptionLength: number,
): string {
  const mandatoryBlock = `👉 ${trackedFunnelUrl}\n🤖 ${telegramDeepLink}`;
  if (mandatoryBlock.length >= maxDescriptionLength) {
    return mandatoryBlock;
  }

  const retained = [...parts];
  while (retained.length > 0 && retained.join('\n\n').length > maxDescriptionLength) {
    let nonLinkIdx = -1;
    for (let i = retained.length - 1; i >= 0; i--) {
      if (!retained[i].includes(trackedFunnelUrl) && !retained[i].includes(telegramDeepLink)) {
        nonLinkIdx = i;
        break;
      }
    }
    if (nonLinkIdx >= 0) {
      retained.splice(nonLinkIdx, 1);
    } else {
      break;
    }
  }

  const result = retained.join('\n\n');
  if (
    result.length <= maxDescriptionLength &&
    result.includes(trackedFunnelUrl) &&
    result.includes(telegramDeepLink)
  ) {
    return result;
  }

  return mandatoryBlock;
}

/**
 * Format SEO description with strict length limit compliance and guaranteed attribution preservation.
 *
 * If the full text exceeds maxDescriptionLength, the middle/body text (title/takeaways) is truncated
 * so that: availableBodyLength = maxDescriptionLength - trailingAttributionBlock.length - overhead.
 * The trailing attribution block (trackedFunnelUrl, telegramDeepLink, hashtags) is appended intact.
 */
export function formatSeoDescription(options: FormatSeoDescriptionOptions): string {
  const {
    platform,
    language,
    rawTitle,
    keyTakeaways = [],
    trackedFunnelUrl,
    telegramDeepLink,
    hashtags,
    referralCode,
    maxDescriptionLength = PLATFORM_LIMITS[platform]?.maxDescriptionLength ?? 2200,
  } = options;

  const cta = CTA_COPY_BY_LANGUAGE[language] ?? CTA_COPY_BY_LANGUAGE.en;
  const hashtagsFormatted = hashtags.join(' ');
  const takeawaysBlock =
    keyTakeaways.length > 0
      ? `📌 Key Takeaways:\n${keyTakeaways.map((k) => `• ${k}`).join('\n')}`
      : '';

  let bodyParts: string[] = [];
  let attributionParts: string[] = [];

  switch (platform) {
    case 'youtube_shorts': {
      bodyParts = [rawTitle, takeawaysBlock].filter(Boolean);
      attributionParts = [
        `${cta.fun}\n👉 ${trackedFunnelUrl}`,
        `${cta.tg}\n🤖 ${telegramDeepLink}`,
        `Use referral code ${referralCode || 'SOLO100'} for special tier bonus!`,
        `${cta.tagHeader}\n${hashtagsFormatted}`,
      ].filter(Boolean);
      break;
    }

    case 'tiktok': {
      bodyParts = [`${rawTitle} 👀`];
      if (takeawaysBlock) {
        bodyParts.push(takeawaysBlock);
      }
      attributionParts = [
        `${cta.fun} Link in bio hoặc click: ${trackedFunnelUrl}`,
        `💬 Demo nhanh qua Telegram: ${telegramDeepLink}`,
        hashtagsFormatted,
      ].filter(Boolean);
      break;
    }

    case 'instagram_reels': {
      bodyParts = [`✨ ${rawTitle}`, takeawaysBlock].filter(Boolean);
      attributionParts = [
        `🔗 Truy cập ngay: ${trackedFunnelUrl}`,
        `💬 Trải nghiệm demo bot: ${telegramDeepLink}`,
        '---',
        hashtagsFormatted,
      ].filter(Boolean);
      break;
    }

    case 'facebook_reels': {
      bodyParts = [
        `🔥 ${rawTitle}`,
        takeawaysBlock,
        '👉 Bình luận "AI" hoặc nhấp vào liên kết bên dưới để nhận hướng dẫn chi tiết:',
      ].filter(Boolean);
      attributionParts = [
        `🌐 Link chi tiết: ${trackedFunnelUrl}`,
        `📲 Nhận mẫu qua Telegram: ${telegramDeepLink}`,
        hashtagsFormatted,
      ].filter(Boolean);
      break;
    }
  }

  const bodyText = bodyParts.join('\n\n').trim();
  const trailingAttributionBlock = attributionParts.join('\n\n').trim();

  // If no body text is available, return trailing attribution block
  if (!bodyText) {
    if (trailingAttributionBlock.length <= maxDescriptionLength) {
      return trailingAttributionBlock;
    }
    return pruneAttributionBlock(attributionParts, trackedFunnelUrl, telegramDeepLink, maxDescriptionLength);
  }

  const fullDescription = `${bodyText}\n\n${trailingAttributionBlock}`;
  if (fullDescription.length <= maxDescriptionLength) {
    return fullDescription;
  }

  // Truncation required: truncate the body text while preserving trailing attribution block intact
  const separator = '\n\n';
  const ellipsis = '...';
  const overhead = ellipsis.length + separator.length; // 5 characters
  const availableBodyLength = maxDescriptionLength - trailingAttributionBlock.length - overhead;

  if (availableBodyLength > 0) {
    const truncatedBody = bodyText.slice(0, availableBodyLength).trimEnd() + ellipsis;
    return `${truncatedBody}${separator}${trailingAttributionBlock}`;
  }

  // If body cannot fit at all, check if trailing attribution block fits
  if (trailingAttributionBlock.length <= maxDescriptionLength) {
    return trailingAttributionBlock;
  }

  // Extreme case: attribution block alone exceeds limit. Prune non-link parts while keeping links 100% intact.
  return pruneAttributionBlock(attributionParts, trackedFunnelUrl, telegramDeepLink, maxDescriptionLength);
}

// ─── Unified Viral Metadata Generator ───────────────────────────────────────

/**
 * Generate fully compliant viral metadata (Hook title, SEO description, hashtags,
 * tracked URLs, and CTR thumbnail prompt) tailored for target language, platform, and niche.
 */
export function generateViralMetadata(input: ViralMetadataInput): ViralMetadataResult {
  const {
    topic,
    niche,
    targetPlatform,
    targetLanguage,
    targetMarket,
    hookArchetype = 'curiosity_gap',
    keyTakeaways = [],
    referralCode,
    customTelegramStart,
    funnelBaseUrl,
    videoJobId = `vid_${Date.now().toString(36)}`,
  } = input;

  const limits = PLATFORM_LIMITS[targetPlatform] ?? { maxTitleLength: 100, maxDescriptionLength: 2200 };

  // 1. Generate Localized Hook Title
  const languageTemplates =
    HOOK_TEMPLATES_BY_LANGUAGE[targetLanguage] ?? HOOK_TEMPLATES_BY_LANGUAGE.en;
  const templateFn =
    languageTemplates[hookArchetype] ?? languageTemplates.curiosity_gap;
  let rawTitle = templateFn(topic);

  // Platform title constraints
  let hookTitle = rawTitle;
  if (targetPlatform === 'youtube_shorts') {
    const shortsTag = ' #Shorts';
    const maxBaseLen = limits.maxTitleLength - shortsTag.length;
    if (hookTitle.length > maxBaseLen) {
      hookTitle = hookTitle.slice(0, maxBaseLen - 3) + '...';
    }
    if (!hookTitle.includes('#Shorts')) {
      hookTitle = `${hookTitle}${shortsTag}`;
    }
  } else {
    if (hookTitle.length > limits.maxTitleLength) {
      hookTitle = hookTitle.slice(0, limits.maxTitleLength - 3) + '...';
    }
  }

  // 2. Build Tracked Funnel & Telegram Deep Link
  const trackedFunnelUrl = buildTrackedFunnelUrl({
    baseUrl: funnelBaseUrl,
    platform: targetPlatform,
    niche,
    hookArchetype,
    videoId: videoJobId,
    referralCode,
  });

  const telegramDeepLink = buildTelegramDeepLink({
    videoId: videoJobId,
    platform: targetPlatform,
    niche,
    referralCode,
    customStart: customTelegramStart,
  });

  // 3. Curate Localized Trending Hashtags
  const langHashtags =
    NICHE_HASHTAGS_BY_LANGUAGE[targetLanguage] ?? NICHE_HASHTAGS_BY_LANGUAGE.en;
  const nicheTags = langHashtags[niche] ?? langHashtags.default ?? ['#SophiaAI', '#AIAutomation'];
  const platformTags = PLATFORM_SIGNATURE_TAGS[targetPlatform] ?? [];

  // Deduplicate and combine
  const combinedHashtags = Array.from(new Set([...platformTags, ...nicheTags]));

  // 4. Construct Platform-Compliant SEO Description with Guaranteed Link Preservation
  const seoDescription = formatSeoDescription({
    platform: targetPlatform,
    language: targetLanguage,
    rawTitle,
    keyTakeaways,
    trackedFunnelUrl,
    telegramDeepLink,
    hashtags: combinedHashtags,
    referralCode,
    maxDescriptionLength: limits.maxDescriptionLength,
  });

  // 5. Generate Thumbnail Specification
  const thumbnailSpec = generateThumbnailPromptSpec({
    topic,
    language: targetLanguage,
    platform: targetPlatform,
    hookHeadline: rawTitle,
  });

  return {
    hookTitle,
    seoDescription,
    hashtags: combinedHashtags,
    thumbnailPrompt: thumbnailSpec.prompt,
    thumbnailSpec,
    trackedFunnelUrl,
    telegramDeepLink,
    platform: targetPlatform,
    language: targetLanguage,
    targetMarket,
    charCount: {
      title: hookTitle.length,
      description: seoDescription.length,
    },
    isCompliant:
      hookTitle.length <= limits.maxTitleLength &&
      seoDescription.length <= limits.maxDescriptionLength,
  };
}
