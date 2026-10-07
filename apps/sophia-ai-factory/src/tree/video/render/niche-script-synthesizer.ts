/**
 * Niche Script Synthesizer
 *
 * Breaks down campaign storyboard plans into scene-by-scene script narrations
 * with visual generation prompts and on-screen caption directives.
 *
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

function buildHookContent(isEn: boolean, productName: string, scene: CalculatedStoryboardScene) {
  return {
    narration: isEn
      ? `Stop scrolling. If you are struggling with ${productName}, you need to see this.`
      : `Dừng lướt lại ngay! Nếu bạn đang gặp khó khăn với ${productName}, đây là giải pháp.`,
    visual: scene.visualPrompt
      ? `${scene.visualPrompt}, vertical 9:16, high contrast`
      : `High-energy vertical 9:16 shot of ${productName}, shocking reveal, 4k ultra realistic, cinematic lighting`,
    overlay: scene.overlayText || (isEn ? '⚠️ GAME CHANGER ALERT' : '⚠️ BÍ MẬT ĐỘT PHÁ'),
  };
}

function buildAgitationContent(isEn: boolean, scene: CalculatedStoryboardScene) {
  return {
    narration: isEn
      ? `Most people waste countless hours doing this manually, losing revenue every single week.`
      : `Hầu hết mọi người đang lãng phí hàng giờ làm thủ công và mất tiền mỗi tuần.`,
    visual: scene.visualPrompt
      ? `${scene.visualPrompt}, vertical 9:16`
      : `Frustrated professional at dark desk, glowing red error screens, fast cuts, 9:16 vertical`,
    overlay: scene.overlayText || (isEn ? 'Are you losing money?' : 'Bạn đang mất doanh thu?'),
  };
}

function buildSolutionContent(isEn: boolean, productName: string, scene: CalculatedStoryboardScene) {
  return {
    narration: isEn
      ? `Here is how ${productName} (${scene.name}) solves this in under 60 seconds with automated precision.`
      : `Đây là cách mà ${productName} (${scene.name}) giải quyết triệt để trong 60 giây hoàn toàn tự động.`,
    visual: scene.visualPrompt
      ? `${scene.visualPrompt}, vertical 9:16`
      : `Sleek futuristic dashboard interface of ${productName}, high-tech glowing green numbers, 9:16 UI demo`,
    overlay: scene.overlayText || (isEn ? 'Effortless Automation' : 'Tự động hóa hoàn hảo'),
  };
}

function buildCtaContent(isEn: boolean, productName: string, scene: CalculatedStoryboardScene) {
  return {
    narration: isEn
      ? `Click the link in bio or pinned comment right now to claim your exclusive access bonus for ${productName}.`
      : `Bấm ngay vào link trong phần mô tả để nhận ưu đãi và quyền truy cập độc quyền ${productName}.`,
    visual: scene.visualPrompt
      ? `${scene.visualPrompt}, vertical 9:16`
      : `Vibrant animated pointer arrow pointing to bottom screen, golden reward glow, 9:16`,
    overlay: scene.overlayText || (isEn ? '👇 GET ACCESS NOW' : '👇 NHẬN ƯU ĐÃI NGAY'),
  };
}

function getSceneContentByRole(
  role: SceneRole,
  isEn: boolean,
  productName: string,
  scene: CalculatedStoryboardScene,
) {
  if (role === 'hook') return buildHookContent(isEn, productName, scene);
  if (role === 'agitation') return buildAgitationContent(isEn, scene);
  if (role === 'solution') return buildSolutionContent(isEn, productName, scene);
  return buildCtaContent(isEn, productName, scene);
}

export function synthesizeNicheScript(plan: NicheVideoCampaignPlan): SynthesizedCampaignScript {
  const { planId, storyboard, prompts } = plan;
  const isEn = prompts.systemPrompt.includes('English');
  const total = storyboard.scenes.length;

  const synthesizedScenes: SynthesizedSceneScript[] = storyboard.scenes.map((scene, idx) => {
    const role = resolveSceneRole(idx, total, scene.name);
    const content = getSceneContentByRole(role, isEn, plan.productName, scene);
    const durationSec = Math.round((scene.durationMs || 0) / 1000);

    return {
      sceneId: `scn_${idx + 1}`,
      order: idx + 1,
      role,
      durationSec,
      narrationText: content.narration,
      visualPrompt: content.visual,
      onScreenText: content.overlay,
    };
  });

  const fullNarration = synthesizedScenes.map((s) => s.narrationText).join(' ');

  return {
    planId,
    productName: plan.productName,
    totalDurationSec: storyboard.totalDurationMs / 1000,
    scenes: synthesizedScenes,
    fullNarration,
  };
}
