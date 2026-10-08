/**
 * @file thumbnail-saliency-engine.ts
 * @description Pure algorithmic engine for Visual Saliency Scoring & CTR Gaze Estimation
 * @layer tree
 */

import type {
  ThumbnailGazeInput,
  SaliencyReport,
} from '@/seed/types/growth-triad-v7-types';

/**
 * Computes visual saliency score, predicted CTR, and composition recommendations
 */
export function evaluateThumbnailSaliency(input: ThumbnailGazeInput): SaliencyReport {
  const contrastFactor = Math.min(1.0, input.luminanceContrastRatio / 10.0);
  const faceFactor = input.faceProminenceIndex;
  const saturationFactor = input.colorSaturation;
  const thirdsFactor = input.ruleOfThirdsAdherence;

  let rawSaliency =
    0.3 * contrastFactor +
    0.3 * faceFactor +
    0.2 * saturationFactor +
    0.2 * thirdsFactor;

  // Clutter penalty: text covering > 35% of thumbnail impairs gaze fixation
  if (input.textOverlayAreaPct > 35) {
    const penalty = Math.min(0.25, (input.textOverlayAreaPct - 35) * 0.01);
    rawSaliency = Math.max(0, rawSaliency - penalty);
  }

  const saliencyScore = Number(Math.min(1.0, Math.max(0, rawSaliency)).toFixed(3));

  // Predicted CTR: baseline 2.5% up to 14.5%
  const predictedCtr = Number((2.5 + saliencyScore * 12.0).toFixed(2));

  let gazeFixationGrade: 'GRADE_A' | 'GRADE_B' | 'GRADE_C' | 'POOR';
  if (saliencyScore >= 0.8) {
    gazeFixationGrade = 'GRADE_A';
  } else if (saliencyScore >= 0.65) {
    gazeFixationGrade = 'GRADE_B';
  } else if (saliencyScore >= 0.5) {
    gazeFixationGrade = 'GRADE_C';
  } else {
    gazeFixationGrade = 'POOR';
  }

  const recommendations: string[] = [];
  if (input.luminanceContrastRatio < 5.0) {
    recommendations.push('Tăng độ tương phản sáng/tối (Luminance Contrast) giữa chữ và nền.');
  }
  if (input.faceProminenceIndex < 0.4) {
    recommendations.push('Phóng to biểu cảm khuôn mặt chủ thể để tăng eye-contact fixation.');
  }
  if (input.ruleOfThirdsAdherence < 0.6) {
    recommendations.push('Căn chỉnh điểm nhìn tiêu cự vào giao điểm 1/3 (Rule of Thirds).');
  }
  if (input.textOverlayAreaPct > 35) {
    recommendations.push('Giảm diện tích chữ text overlay (< 30%) để tránh che lấp chủ thể.');
  }
  if (recommendations.length === 0) {
    recommendations.push('Bố cục thumbnail đạt chuẩn tối ưu tỷ lệ click CTR.');
  }

  return {
    saliencyScore,
    predictedCtrPct: predictedCtr,
    gazeFixationGrade,
    recommendations,
  };
}
