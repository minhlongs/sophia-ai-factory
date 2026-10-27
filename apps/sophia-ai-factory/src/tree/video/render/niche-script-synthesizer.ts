/**
 * Niche Script Synthesizer
 * Breaks down campaign storyboard plans into scene-by-scene script narrations.
 * Layer: tree/video/render (Domain Logic)
 * @module tree/video/render/niche-script-synthesizer
 */

import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import type { CalculatedStoryboardScene } from '@/tree/video/prompts/storyboard-generator';

export type SceneRole = 'hook' | 'agitation' | 'solution' | 'cta';

export interface SynthesizedSceneScript {
  sceneId: string;
  order: number;
  role: SceneRole;
  durationSec: number;
  narrationText: string;
  visualPrompt: string;
  onScreenText?: string;
}

export interface SynthesizedCampaignScript {
  planId: string;
  productName: string;
  totalDurationSec: number;
  scenes: SynthesizedSceneScript[];
  fullNarration: string;
}

function resolveSceneRole(idx: number, total: number, name?: string): SceneRole {
  const nameLower = name?.toLowerCase() || '';
  if (idx === 0 || nameLower.includes('hook')) return 'hook';
  if (idx === 1 || nameLower.includes('agitation') || nameLower.includes('chaos')) return 'agitation';
  if (idx === total - 1 || nameLower.includes('cta') || nameLower.includes('end-card')) return 'cta';
  return 'solution';
}

function getSceneContentByRole(role: SceneRole, isEn: boolean, productName: string, scene: CalculatedStoryboardScene) {
  if (role === 'hook') {
    return {
      narration: isEn ? `Stop scrolling. If you are struggling with ${productName}, you need to see this.` : `Dừng lướt lại ngay! Nếu bạn đang gặp khó khăn với ${productName}, đây là giải pháp.`,
      visual: scene.visualPrompt ? `${scene.visualPrompt}, vertical 9:16, high contrast` : `High-energy vertical 9:16 shot of ${productName}, shocking reveal, 4k ultra realistic, cinematic lighting`,
      overlay: scene.overlayText || (isEn ? '⚠️ GAME CHANGER ALERT' : '⚠️ BÍ MẬT ĐỘT PHÁ'),
    };
  }
  if (role === 'agitation') {
    return {
      narration: isEn ? `Most people waste countless hours doing this manually, losing revenue every single week.` : `Hầu hết mọi người đang lãng phí hàng giờ làm thủ công và mất tiền mỗi tuần.`,
      visual: scene.visualPrompt ? `${scene.visualPrompt}, vertical 9:16` : `Frustrated professional at dark desk, glowing red error screens, fast cuts, 9:16 vertical`,
      overlay: scene.overlayText || (isEn ? 'Are you losing money?' : 'Bạn đang mất doanh thu?'),
    };
  }
  if (role === 'solution') {
    return {
      // No speed/efficiency claim: none of those facts comes from the offer.
      narration: isEn ? `Here is how ${productName} (${scene.name}) fits into that workflow.` : `Đây là cách ${productName} (${scene.name}) phù hợp với quy trình đó.`,
      visual: scene.visualPrompt ? `${scene.visualPrompt}, vertical 9:16` : `Sleek futuristic dashboard interface of ${productName}, high-tech glowing green numbers, 9:16 UI demo`,
      overlay: scene.overlayText || (isEn ? 'See How It Works' : 'Xem Cách Hoạt Động'),
    };
  }
  return {
    // No "exclusive bonus": an unsourced incentive is a false claim. The CTA
    // points at the approved tracked link and states the affiliate disclosure.
    narration: isEn ? `Learn more about ${productName} using the partner link in the description. We may earn a commission.` : `Tìm hiểu thêm về ${productName} qua liên kết đối tác trong phần mô tả. Chúng tôi có thể nhận hoa hồng.`,
    visual: scene.visualPrompt ? `${scene.visualPrompt}, vertical 9:16` : `Clean link-in-description end card with affiliate disclosure, 9:16`,
    overlay: scene.overlayText || (isEn ? '👇 PARTNER LINK IN DESCRIPTION' : '👇 LIÊN KẾT Ở MÔ TẢ'),
  };
}

export function synthesizeNicheScript(
  plan: NicheVideoCampaignPlan,
  explicitLocale?: 'en' | 'vi',
): SynthesizedCampaignScript {
  const { planId, storyboard, prompts } = plan;
  const locale = explicitLocale ?? plan.locale ?? (prompts.systemPrompt.includes('Vietnamese') ? 'vi' : 'en');
  const isEn = locale === 'en';
  const total = storyboard.scenes.length;

  const synthesizedScenes: SynthesizedSceneScript[] = storyboard.scenes.map((scene, idx) => {
    const role = resolveSceneRole(idx, total, scene.name);
    const content = getSceneContentByRole(role, isEn, plan.productName, scene);
    return {
      sceneId: `scn_${idx + 1}`,
      order: idx + 1,
      role,
      durationSec: Math.round((scene.durationMs || 0) / 1000),
      narrationText: content.narration,
      visualPrompt: content.visual,
      onScreenText: content.overlay,
    };
  });

  return {
    planId,
    productName: plan.productName,
    totalDurationSec: storyboard.totalDurationMs / 1000,
    scenes: synthesizedScenes,
    fullNarration: synthesizedScenes.map((s) => s.narrationText).join(' '),
  };
}
