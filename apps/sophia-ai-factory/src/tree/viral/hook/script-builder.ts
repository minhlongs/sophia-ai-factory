/**
 * @file script-builder.ts
 * @layer tree/viral/hook
 * @description Short-form video script synthesis tailored for niches.
 */

import type {
  ViralNiche,
  ViralScript,
  ViralScriptSection,
} from '@/seed/types/growth';
import {
  NICHE_PROFILES,
  DETERMINISTIC_HOOK_VAULT,
  DETERMINISTIC_SCRIPT_TEMPLATES,
} from '../hook-prompts';
import { generateViralHooks } from './hooks-discovery';
import type { GenerateScriptOptions } from './types';

export function buildFunnelCta(
  niche: ViralNiche,
  referralCode?: string,
  telegramStartParam?: string,
  _locale: 'en' | 'vi' = 'en'
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

  const matchingTemplate = DETERMINISTIC_SCRIPT_TEMPLATES.find(
    (t) => t.hookId === hook?.id || t.niche === niche
  );

  const ctaInfo = buildFunnelCta(niche, referralCode, telegramStartParam);
  const nicheProfile = NICHE_PROFILES[niche];

  let rawSections: ViralScriptSection[];

  if (matchingTemplate && !customTopic) {
    rawSections = matchingTemplate.sections;
  } else {
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
        narrationVi: `Hầu hết nhà sáng tạo và đội nhóm tốn hàng chục giờ cặm cụi xử lý ${topicLabelVi} theo cách thủ công.`,
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

  const totalBaseSec = rawSections.reduce((acc, s) => acc + s.durationSec, 0);
  const ratio = targetDurationSec / totalBaseSec;

  const adjustedSections = rawSections.map((s, idx) => {
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
