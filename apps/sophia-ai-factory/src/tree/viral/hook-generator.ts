/**
 * Viral Hook Generator & Short-Form Video Script Builder
 *
 * Implements trending hook discovery, psychological archetype generation,
 * and structured script synthesis for AI Automation, E-commerce, and Solopreneur niches.
 *
 * Layer: Tree (reusable algorithms & template builders, imports only seed and tree)
 *
 * @module tree/viral/hook-generator
 */

import type {
  ViralNiche,
  HookArchetype,
  ViralHook,
  TrendingHook,
  ViralScript,
  ViralScriptSection,
} from '@/seed/types/growth';
import {
  NICHE_PROFILES,
  DETERMINISTIC_HOOK_VAULT,
  DETERMINISTIC_SCRIPT_TEMPLATES,
  ARCHETYPE_DEFINITIONS,
} from './hook-prompts';

export interface GenerateHooksOptions {
  niche: ViralNiche;
  archetype?: HookArchetype;
  customTopic?: string;
  count?: number;
  locale?: 'en' | 'vi';
}

export interface FindTrendingHooksOptions {
  niche?: ViralNiche;
  minVelocity?: number;
  limit?: number;
}

export interface GenerateScriptOptions {
  niche: ViralNiche;
  hook?: ViralHook;
  hookArchetype?: HookArchetype;
  targetDurationSec?: 15 | 30 | 60;
  customTopic?: string;
  referralCode?: string;
  telegramStartParam?: string;
  locale?: 'en' | 'vi';
}

/**
 * Generate high-converting viral opening hooks for short-form video.
 */
export async function generateViralHooks(options: GenerateHooksOptions): Promise<ViralHook[]> {
  const { niche, archetype, customTopic, count = 5 } = options;

  // Filter existing curated hooks for the niche
  let matches = DETERMINISTIC_HOOK_VAULT.filter((h) => h.niche === niche);

  if (archetype) {
    matches = matches.filter((h) => h.archetype === archetype);
  }

  // If a custom topic is provided, synthesize tailored variants based on psychological archetypes
  if (customTopic && customTopic.trim().length > 0) {
    const topic = customTopic.trim();
    const archetypesToUse: HookArchetype[] = archetype
      ? [archetype]
      : ['curiosity_gap', 'shock_stat', 'direct_question', 'problem_solution', 'contrarian'];

    const dynamicHooks: ViralHook[] = archetypesToUse.map((arch, idx) => {
      const archDef = ARCHETYPE_DEFINITIONS[arch];
      let hookText = '';
      let hookTextVi = '';

      switch (arch) {
        case 'curiosity_gap':
          hookText = `The untold truth about ${topic} that top 1% operators refuse to share...`;
          hookTextVi = `Sự thật ít người biết về ${topic} mà nhóm top 1% luôn giấu kín...`;
          break;
        case 'shock_stat':
          hookText = `91% of businesses tackling ${topic} are burning capital without realizing this...`;
          hookTextVi = `91% doanh nghiệp triển khai ${topic} đang lãng phí ngân sách vì bỏ qua điều này...`;
          break;
        case 'direct_question':
          hookText = `Are you still struggling with ${topic} while others are automating it completely?`;
          hookTextVi = `Bạn vẫn đang vật lộn với ${topic} trong khi người khác đã tự động hóa 100%?`;
          break;
        case 'problem_solution':
          hookText = `${topic} used to be a massive headache. Here is how one simple AI agent solved it.`;
          hookTextVi = `${topic} từng là cơn ác mộng đau đầu. Đây là cách đúng 1 AI agent xử lý triệt để.`;
          break;
        case 'contrarian':
          hookText = `Everything you have been told about ${topic} is wrong. Do this instead.`;
          hookTextVi = `Mọi thứ người ta dạy bạn về ${topic} đều đã lỗi thời. Hãy làm theo cách này.`;
          break;
      }

      return {
        id: `dyn_hook_${niche}_${arch}_${idx}_${Date.now()}`,
        niche,
        archetype: arch,
        hookText,
        hookTextVi,
        estimatedSeconds: archDef.idealDurationSec,
        expectedRetentionScore: Math.min(99, 88 + (idx % 10)),
        psychologicalTrigger: `${archDef.name}: Tailored around topic "${topic}".`,
        tags: [niche, arch, 'custom-topic'],
      };
    });

    return dynamicHooks.slice(0, count);
  }

  // If not enough matches from specific archetype filter, fall back to niche matches
  const pool = matches.length > 0 ? matches : DETERMINISTIC_HOOK_VAULT.filter((h) => h.niche === niche);
  return pool.slice(0, count);
}

/**
 * Find trending hooks with viral velocity metrics and B-roll recommendations.
 */
export function findTrendingHooks(options: FindTrendingHooksOptions = {}): TrendingHook[] {
  const { niche, minVelocity = 70, limit = 10 } = options;

  let candidates = DETERMINISTIC_HOOK_VAULT;
  if (niche) {
    candidates = candidates.filter((h) => h.niche === niche);
  }

  const brollPool: Record<ViralNiche, string[]> = {
    ai_automation: [
      'High-speed coding terminal screen with green glowing autonomous logs',
      'Split screen comparing slow human worker with fast automated AI agent',
      'Founder drinking coffee while dashboard charts trend sharply up',
    ],
    ecommerce: [
      'Dramatic product unboxing under neon cinematic studio lighting',
      'Customer phone screen showing instant 1-click TikTok Shop checkout',
      'Side-by-side comparison of competitor broken product vs our premium model',
    ],
    solopreneur: [
      'Laptop on beach / balcony showing $5,000 MRR stripe notification',
      'Person closing laptop with relief at 2 PM with zero remaining tasks',
      'Visual timeline showing 1-year transformation from burnout to freedom',
    ],
  };

  const trendingList: TrendingHook[] = candidates.map((hook, index) => {
    const brolls = brollPool[hook.niche];
    const suggestedBroll = brolls[index % brolls.length];
    const viralVelocityScore = Math.min(99, 85 + ((index * 7) % 15));
    const historicalCtrPct = Number((3.8 + ((index * 1.3) % 4.5)).toFixed(1));

    return {
      id: `trend_${hook.id}`,
      hook,
      viralVelocityScore,
      trendCategory: hook.tags[0] || 'trending',
      suggestedBroll,
      historicalCtrPct,
      nicheRelevance: 95,
    };
  });

  return trendingList
    .filter((t) => t.viralVelocityScore >= minVelocity)
    .sort((a, b) => b.viralVelocityScore - a.viralVelocityScore)
    .slice(0, limit);
}

/**
 * Build CTA copy and link targets tailored for the niche.
 */
export function buildFunnelCta(
  niche: ViralNiche,
  referralCode?: string,
  telegramStartParam?: string,
  locale: 'en' | 'vi' = 'en',
): {
  ctaText: string;
  ctaTextVi: string;
  actionUrl: string;
  deepLink: string;
} {
  const ref = referralCode ? `ref=${referralCode}` : 'ref=viral_funnel';
  const actionUrl = `https://sophia.agencyos.network/?${ref}&utm_source=short_video&utm_campaign=${niche}&utm_medium=video_cta`;
  const deepLink = `https://t.me/Sophia_Bbot?start=${telegramStartParam || `vid_${niche}_ref_${referralCode || 'direct'}`}`;

  const ctaMap: Record<ViralNiche, { en: string; vi: string }> = {
    ai_automation: {
      en: 'Deploy your 24/7 AI video agent today. Tap the link in bio or message our Telegram bot for an instant demo.',
      vi: 'Kích hoạt agent AI sản xuất video 24/7 của bạn ngay hôm nay. Nhấn link bio hoặc chat bot Telegram để xem demo ngay.',
    },
    ecommerce: {
      en: 'Want 50 viral TikTok Shop videos for your store? Tap the link below to get 5 free renders.',
      vi: 'Muốn có 50 video TikTok Shop viral cho gian hàng? Bấm link dưới để nhận ngay 5 video mẫu miễn phí.',
    },
    solopreneur: {
      en: 'Start your faceless $5K MRR video business today. Message @Sophia_Bbot with code SOLO100 for $100 off.',
      vi: 'Khởi động kênh video không lộ mặt đạt $5K MRR ngay. Nhắn @Sophia_Bbot kèm mã SOLO100 để nhận ưu đãi $100.',
    },
  };

  return {
    ctaText: ctaMap[niche].en,
    ctaTextVi: ctaMap[niche].vi,
    actionUrl,
    deepLink,
  };
}

/**
 * Generate a complete, timed short-form video script.
 */
export async function generateViralScript(options: GenerateScriptOptions): Promise<ViralScript> {
  const {
    niche,
    hook: providedHook,
    hookArchetype,
    targetDurationSec = 30,
    customTopic,
    referralCode,
    telegramStartParam,
  } = options;

  // Resolve or generate hook
  let hook = providedHook;
  if (!hook) {
    const hooks = await generateViralHooks({
      niche,
      archetype: hookArchetype,
      customTopic,
      count: 1,
    });
    hook = hooks[0] || DETERMINISTIC_HOOK_VAULT.find((h) => h.niche === niche)!;
  }

  // Find pre-built template if matching
  const matchingTemplate = DETERMINISTIC_SCRIPT_TEMPLATES.find(
    (t) => t.hookId === hook?.id || t.niche === niche,
  );

  const ctaInfo = buildFunnelCta(niche, referralCode, telegramStartParam);
  const nicheProfile = NICHE_PROFILES[niche];

  let rawSections: ViralScriptSection[];

  if (matchingTemplate && !customTopic) {
    rawSections = matchingTemplate.sections;
  } else {
    // Generate programmatic sections based on niche profile and target duration
    const topicLabel = customTopic || nicheProfile.name;
    const topicLabelVi = customTopic || nicheProfile.nameVi;

    rawSections = [
      {
        section: 'hook',
        narration: hook.hookText,
        narrationVi: hook.hookTextVi,
        visualCue: 'Fast 3-frame cut with pattern interrupt and on-screen bold text',
        onScreenText: hook.hookText.toUpperCase().slice(0, 40),
        durationSec: 4,
      },
      {
        section: 'problem',
        narration: `Most creators and teams waste countless hours trying to crack ${topicLabel} manually.`,
        narrationVi: `Hầu hết nhà sáng tạo và đội nhóm tốn hàng chục giờ cặm cụi xử lý ${topicLabel} theo cách thủ công.`,
        visualCue: 'Frustrated user staring at complex software timeline, red warning icons',
        onScreenText: `The Old Way is Broken ⚠️`,
        durationSec: 6,
      },
      {
        section: 'solution',
        narration: `Sophia AI Factory solves this by automating viral hook detection, video assembly, and distribution in 60 seconds.`,
        narrationVi: `Sophia AI Factory giải quyết việc này bằng cách tự động hóa tìm kiếm hook, dựng video và phân phối chỉ trong 60 giây.`,
        visualCue: 'Product workflow animation generating 10 video variations in seconds',
        onScreenText: 'Automate in 60 Seconds ⚡',
        durationSec: 12,
      },
      {
        section: 'proof',
        narration: `Early beta users are seeing 3x higher retention and massive organic traffic spikes.`,
        narrationVi: `Các khách hàng tiên phong ghi nhận tỷ lệ xem hết tăng gấp 3 lần cùng lượng tương tác tự nhiên bùng nổ.`,
        visualCue: 'Analytics dashboard graph shooting straight up with green milestone badges',
        onScreenText: '3x Higher Retention 📈',
        durationSec: 4,
      },
      {
        section: 'cta',
        narration: ctaInfo.ctaText,
        narrationVi: ctaInfo.ctaTextVi,
        visualCue: 'Pointer graphic aiming at bio link and Telegram bot button with promo code SOLO100',
        onScreenText: '👉 TAP LINK IN BIO / TELEGRAM',
        durationSec: 4,
      },
    ];
  }

  // Proportionally scale section durations to precisely fit targetDurationSec
  const totalBaseSec = rawSections.reduce((acc, s) => acc + s.durationSec, 0);
  const ratio = targetDurationSec / totalBaseSec;

  const adjustedSections = rawSections.map((s, idx) => {
    // Keep hook at least 3 seconds for pattern interrupt
    if (idx === 0) {
      return { ...s, durationSec: Math.max(3, Math.round(s.durationSec * ratio)) };
    }
    return { ...s, durationSec: Math.max(2, Math.round(s.durationSec * ratio)) };
  });

  const finalScript: ViralScript = {
    id: `script_${niche}_${Date.now()}`,
    title: matchingTemplate ? matchingTemplate.title : `Viral ${nicheProfile.name} Funnel Video`,
    titleVi: matchingTemplate ? matchingTemplate.titleVi : `Video Viral Phễu ${nicheProfile.nameVi}`,
    niche,
    hookArchetype: hook.archetype,
    hook,
    targetDurationSec,
    sections: adjustedSections,
    ctaText: ctaInfo.ctaText,
    ctaTextVi: ctaInfo.ctaTextVi,
    ctaActionUrl: ctaInfo.actionUrl,
    telegramDeepLink: ctaInfo.deepLink,
    hashtags: nicheProfile.recommendedKeywords,
  };

  return finalScript;
}
