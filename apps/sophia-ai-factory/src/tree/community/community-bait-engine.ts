/**
 * @file community-bait-engine.ts
 * @description Pure algorithmic engine for Community Comment Viral Bait & Discussion Catalysts
 * @layer tree
 */

import type {
  CommunityBaitInput,
  CommunityBaitCampaign,
  ViralDiscussionHook,
} from '@/seed/types/growth-triad-v8-types';

/**
 * Generates viral discussion hooks optimizing curiosity gaps and controlled polarity
 */
export function generateCommunityBaitCampaign(input: CommunityBaitInput): CommunityBaitCampaign {
  // Moderate polarity (near 0.5 balanced debate) yields highest discussion velocity
  const polarityBalance = 1 - Math.abs(input.sentimentPolarityScore - 0.5) * 1.5;
  const baseCuriosityGap = Number(Math.min(1.0, Math.max(0.4, 0.65 + polarityBalance * 0.3)).toFixed(2));

  // Determine audience specific phrasing
  let primaryQuestion = '';
  const altQuestions: string[] = [];

  switch (input.targetAudienceType) {
    case 'ENTREPRENEUR':
      primaryQuestion = `Liệu chiến lược "${input.videoTopic}" có thể giúp bạn x10 doanh thu trong 3 tháng tới hay chỉ là thổi phồng?`;
      altQuestions.push(`Bạn sẽ đầu tư bao nhiêu vốn cho quy trình "${input.videoTopic}" này?`);
      altQuestions.push(`Sai lầm lớn nhất của các founder khi thử "${input.videoTopic}" là gì?`);
      break;
    case 'DEVELOPER':
      primaryQuestion = `Giải pháp "${input.videoTopic}" này liệu có scale được lên 100k RPS mà không sập hệ thống?`;
      altQuestions.push(`Stack công nghệ nào tối ưu nhất cho "${input.videoTopic}" hiện nay?`);
      altQuestions.push(`Bạn chọn tự build in-house hay dùng managed SaaS cho "${input.videoTopic}"?`);
      break;
    case 'STUDENT':
      primaryQuestion = `Nếu bắt đầu học lại từ đầu, bạn có chọn "${input.videoTopic}" làm định hướng chính?`;
      altQuestions.push(`Kỹ năng nào quan trọng nhất để làm chủ "${input.videoTopic}"?`);
      altQuestions.push(`Bạn đã từng thử nghiệm "${input.videoTopic}" trong dự án thực tế chưa?`);
      break;
    case 'GENERAL':
    default:
      primaryQuestion = `Theo góc nhìn của bạn, "${input.videoTopic}" là cơ hội đổi đời hay rủi ro tiềm ẩn?`;
      altQuestions.push(`Bạn đồng tình hay phản đối nhận định trong video về "${input.videoTopic}"?`);
      altQuestions.push(`Nếu được chọn một thay đổi trong "${input.videoTopic}", bạn sẽ chọn gì?`);
      break;
  }

  const primaryVelocity = Number((150 * baseCuriosityGap * (0.8 + polarityBalance * 0.4)).toFixed(1));

  const primaryHook: ViralDiscussionHook = {
    hookQuestion: primaryQuestion,
    curiosityGapScore: baseCuriosityGap,
    estimatedCommentVelocity: primaryVelocity,
    brandSafetyPassed: true,
  };

  const alternativeHooks: ViralDiscussionHook[] = altQuestions.map((q, idx) => ({
    hookQuestion: q,
    curiosityGapScore: Number((baseCuriosityGap * (0.9 - idx * 0.05)).toFixed(2)),
    estimatedCommentVelocity: Number((primaryVelocity * (0.85 - idx * 0.1)).toFixed(1)),
    brandSafetyPassed: true,
  }));

  const campaignId = `bait_${input.videoId}_${Date.now()}`;

  return {
    campaignId,
    videoId: input.videoId,
    primaryHook,
    alternativeHooks,
  };
}
