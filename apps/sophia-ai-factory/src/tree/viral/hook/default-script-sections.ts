/**
 * @file default-script-sections.ts
 * @layer tree/viral/hook
 * @description Default section assembly and duration scaling for viral video scripts.
 */

import type { ViralHook, ViralScriptSection } from '@/seed/types/growth';

export function buildDefaultViralSections(
  hook: ViralHook,
  topicLabel: string,
  topicLabelVi: string,
  ctaText: string,
  ctaTextVi: string,
): ViralScriptSection[] {
  return [
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
      narration: ctaText,
      narrationVi: ctaTextVi,
      visualCue: 'Pointer graphic aiming at bio link and Telegram bot button with promo code SOLO100',
      onScreenText: '👉 TAP LINK IN BIO / TELEGRAM',
      durationSec: 4,
    },
  ];
}

export function scaleSectionDurations(
  rawSections: ViralScriptSection[],
  targetDurationSec: number,
): ViralScriptSection[] {
  const totalBaseSec = rawSections.reduce((acc, s) => acc + s.durationSec, 0);
  const ratio = targetDurationSec / totalBaseSec;

  return rawSections.map((s, idx) => {
    if (idx === 0) {
      return { ...s, durationSec: Math.max(3, Math.round(s.durationSec * ratio)) };
    }
    return { ...s, durationSec: Math.max(2, Math.round(s.durationSec * ratio)) };
  });
}
