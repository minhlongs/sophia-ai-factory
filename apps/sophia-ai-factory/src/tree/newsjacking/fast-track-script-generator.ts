/**
 * @file fast-track-script-generator.ts
 * @description Generates sub-120s viral newsjack scripts and visual prompts
 * @layer tree
 */

export interface FastTrackScriptPlan {
  hook3s: string;
  problemBody20s: string;
  cta7s: string;
  visualSlidePrompts: string[];
  targetDurationSec: number;
}

/**
 * Builds high-converting newsjack video script structure.
 */
export function buildFastTrackNewsjackPlan(
  trendTopic: string,
  productTitle: string,
  niche: string,
): FastTrackScriptPlan {
  const hook3s = `Đừng bỏ qua tin này: ${trendTopic} đang khiến mọi người tá hỏa!`;
  const problemBody20s = `Trong khi ai cũng đang xôn xao về ${trendTopic}, giải pháp thông minh nhất hiện nay là trang bị ngay ${productTitle}. Vừa tiết kiệm thời gian, vừa bảo vệ quyền lợi của bạn tối đa trong ngách ${niche}.`;
  const cta7s = `Bấm ngay link bên dưới để nhận ưu đãi có hạn trước khi đóng cổng!`;

  const visualSlidePrompts = [
    `Hyper-realistic cinematic breaking news graphic featuring ${trendTopic}, viral headline aesthetic, 9:16 vertical`,
    `Close-up demonstration showing how ${productTitle} solves the crisis, sleek modern lighting, high retention visual`,
    `High-converting call to action graphic with animated pointing arrow towards bio link, scarcity countdown banner`,
  ];

  return {
    hook3s,
    problemBody20s,
    cta7s,
    visualSlidePrompts,
    targetDurationSec: 30,
  };
}
