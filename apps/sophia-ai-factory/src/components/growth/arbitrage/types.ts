'use client';

/**
 * Arbitrage Card Types and Constants
 *
 * @module components/growth/arbitrage/types
 */

import React from 'react';

export interface ArbitragePlatformRow {
  platform: 'TIKTOK' | 'YOUTUBE_SHORTS' | 'INSTAGRAM_REELS' | string;
  name: string;
  governingMetric: string;
  calculatedScore: number;
  hookMutation: string;
  status: 'OPTIMIZED' | 'QUEUED' | 'PENDING' | 'Optimized' | 'Queued' | 'Pending' | string;
}

export interface ArbitrageComputeHud {
  regime?: string;
  regimeDescription?: string;
  heygenDispatched?: number;
  heygenCapacityPercent?: number;
  didDispatched?: number;
  didCapacityPercent?: number;
  circuitBreakerStatus?: string;
}

export interface ArbitrageMetricsData {
  reachLiftPercentage?: number;
  reachLiftComparison?: string;
  computeSavingsUsd?: number;
  computeSavingsNote?: string;
  activeHookDivergenceJsd?: number;
  divergenceNote?: string;
  shadowbanAvoidanceRate?: number;
  shadowbanNote?: string;
  platformMatrix?: ArbitragePlatformRow[];
  computeHud?: ArbitrageComputeHud;
}

export interface ArbitrageCardProps {
  data?: ArbitrageMetricsData;
  locale?: 'en' | 'vi';
  onRecalibrate?: () => Promise<void> | void;
  onExecute?: () => Promise<void> | void;
  className?: string;
}

export const DEFAULT_PLATFORM_MATRIX: ArbitragePlatformRow[] = [
  {
    platform: 'TIKTOK',
    name: 'TikTok',
    governingMetric: 'Completion Rate (0.35) + Rewatch (0.30)',
    calculatedScore: 0.884,
    hookMutation: '3s High-Pacing Cut + Sound Tag',
    status: 'Optimized',
  },
  {
    platform: 'YOUTUBE_SHORTS',
    name: 'YouTube Shorts',
    governingMetric: 'Viewed vs Swiped (0.45)',
    calculatedScore: 0.912,
    hookMutation: 'Looping Audio Endcard + Curiosity Title',
    status: 'Optimized',
  },
  {
    platform: 'INSTAGRAM_REELS',
    name: 'Instagram Reels',
    governingMetric: 'DM Share Rate (0.40) + Saves (0.30)',
    calculatedScore: 0.765,
    hookMutation: '"Send to a friend" Trigger Text',
    status: 'Queued',
  },
];

export const DICTIONARY = {
  en: {
    badge: 'Growth Triad v11',
    liveOptimization: 'Live Optimization',
    title: 'Cross-Platform Virality & Compute Arbitrage',
    subtitle: 'Automated reach multipliers across TikTok, YouTube Shorts & IG Reels paired with off-peak token savings.',
    recalibrateAll: 'Recalibrate All',
    executeArbitrage: 'Execute Arbitrage',
    recalibrating: 'Recalibrating...',
    executing: 'Executing...',
    reachLift: 'Syndicated Reach Lift',
    reachLiftComparison: '↑ 12.4% vs un-arbitraged cross-posts',
    computeSavings: 'Compute Cost Saved',
    computeSavingsNote: 'Via off-peak queues & dynamic models',
    hookDivergence: 'Active Hook Divergence',
    hookDivergenceNote: 'Within optimal platform variance zone',
    shadowbanAvoidance: 'Shadowban Avoidance',
    shadowbanNote: 'Zero watermarking flags triggered',
    matrixTitle: 'Platform Arbitrage & Hook Alignment Matrix',
    autopilotActive: 'Autopilot Active',
    colPlatform: 'Destination Platform',
    colMetric: 'Governing Metric',
    colScore: 'Calculated Score',
    colMutation: 'Hook Mutation',
    colStatus: 'Status',
    statusOptimized: 'Optimized',
    statusQueued: 'Queued',
    statusPending: 'Pending',
    computeTitle: 'Opportunistic Compute Engine',
    computeRegime: 'Current Compute Regime',
    regimeOffPeak: 'OFF-PEAK QUEUE',
    regimeOffPeakDesc: 'Non-urgent b-roll batch generation held for low-cost window (02:00-08:00 UTC). Marginal savings: 42%.',
    heygenLabel: 'HeyGen Photoreal (High-Velocity Videos)',
    heygenDispatchedSuffix: 'dispatched',
    didLabel: 'D-ID Express (Cold-Start / Basic Tier)',
    didDispatchedSuffix: 'degraded/fast',
    circuitBreaker: 'Circuit Breaker Status',
    circuitBreakerHealthy: 'ALL CLOSED (HEALTHY)',
    actionSuccess: 'Action completed successfully',
  },
  vi: {
    badge: 'Growth Triad v11',
    liveOptimization: 'Tối ưu hóa Trực tiếp',
    title: 'Chênh lệch Lan truyền & Chi phí Tính toán Đa nền tảng',
    subtitle: 'Tự động nhân hệ số tiếp cận trên TikTok, YouTube Shorts & IG Reels kết hợp tiết kiệm token ngoài giờ cao điểm.',
    recalibrateAll: 'Hiệu chỉnh lại Tất cả',
    executeArbitrage: 'Thực thi Arbitrage',
    recalibrating: 'Đang hiệu chỉnh...',
    executing: 'Đang thực thi...',
    reachLift: 'Tăng trưởng Tiếp cận Phối hợp',
    reachLiftComparison: '↑ 12.4% so với đăng chéo không tối ưu',
    computeSavings: 'Chi phí Tính toán Tiết kiệm',
    computeSavingsNote: 'Qua hàng đợi ngoài giờ cao điểm & mô hình động',
    hookDivergence: 'Độ lệch Hook Đang hoạt động',
    hookDivergenceNote: 'Nằm trong vùng biến thiên tối ưu của nền tảng',
    shadowbanAvoidance: 'Tránh Shadowban',
    shadowbanNote: 'Không kích hoạt cờ watermark nào',
    matrixTitle: 'Ma trận Arbitrage Nền tảng & Căn chỉnh Hook',
    autopilotActive: 'Tự động hóa Đang bật',
    colPlatform: 'Nền tảng Đích',
    colMetric: 'Chỉ số Trọng yếu',
    colScore: 'Điểm Tính toán',
    colMutation: 'Biến thể Hook',
    colStatus: 'Trạng thái',
    statusOptimized: 'Đã tối ưu',
    statusQueued: 'Đang chờ',
    statusPending: 'Đang xử lý',
    computeTitle: 'Động cơ Tính toán Cơ hội',
    computeRegime: 'Chế độ Tính toán Hiện tại',
    regimeOffPeak: 'HÀNG ĐỢI NGOÀI GIỜ',
    regimeOffPeakDesc: 'Tạo video b-roll không khẩn cấp trong khung giờ giá rẻ (02:00-08:00 UTC). Tiết kiệm biên: 42%.',
    heygenLabel: 'HeyGen Photoreal (Video Tốc độ cao)',
    heygenDispatchedSuffix: 'đã điều phối',
    didLabel: 'D-ID Express (Cold-Start / Gói Cơ bản)',
    didDispatchedSuffix: 'nhanh/tối ưu chi phí',
    circuitBreaker: 'Trạng thái Bộ ngắt mạch',
    circuitBreakerHealthy: 'TẤT CẢ ĐÓNG (KHỎE MẠNH)',
    actionSuccess: 'Thao tác hoàn tất thành công',
  },
} as const;

export type DictType = typeof DICTIONARY['en'] | typeof DICTIONARY['vi'];
