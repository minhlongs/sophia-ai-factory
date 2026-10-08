'use client';

/**
 * arbitrage-card.tsx
 * Growth Triad v11: Cross-Platform Virality & Opportunistic Compute Arbitrage Cockpit Component
 *
 * Wireframe reference: docs/wireframe/growth-triad-v11.html
 * Visual styling: Amber #CA7F16 accents, warm buttons, KPI grid, Matrix table & Compute HUD.
 *
 * @module components/growth/arbitrage-card
 */

import React, { useState } from 'react';

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

const DEFAULT_PLATFORM_MATRIX: ArbitragePlatformRow[] = [
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

const DICTIONARY = {
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

type DictType = typeof DICTIONARY['en'] | typeof DICTIONARY['vi'];

function getPlatformDot(platform: string): React.ReactNode {
  const normalized = platform.toUpperCase();
  if (normalized.includes('TIKTOK')) {
    return <span className="w-2.5 h-2.5 rounded-full bg-black inline-block" aria-hidden="true" />;
  }
  if (normalized.includes('YOUTUBE') || normalized.includes('SHORTS')) {
    return <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" aria-hidden="true" />;
  }
  return <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" aria-hidden="true" />;
}

function getScoreColor(platform: string): string {
  const normalized = platform.toUpperCase();
  if (normalized.includes('TIKTOK')) return 'text-[#CA7F16]';
  if (normalized.includes('YOUTUBE') || normalized.includes('SHORTS')) return 'text-red-600';
  return 'text-pink-600';
}

function getStatusBadge(status: string, dict: DictType): React.ReactNode {
  const upper = status.toUpperCase();
  if (upper === 'OPTIMIZED' || upper === 'ĐÃ TỐI ƯU') {
    return (
      <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">
        {dict.statusOptimized}
      </span>
    );
  }
  if (upper === 'QUEUED' || upper === 'ĐANG CHỜ') {
    return (
      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">
        {dict.statusQueued}
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">
      {dict.statusPending}
    </span>
  );
}

function ArbitrageKpiRow({
  dict,
  reachLift,
  reachLiftComparison,
  computeSavings,
  computeSavingsNote,
  hookDivergence,
  divergenceNote,
  shadowbanRate,
  shadowbanNote,
}: {
  dict: DictType;
  reachLift: number;
  reachLiftComparison: string;
  computeSavings: number;
  computeSavingsNote: string;
  hookDivergence: number;
  divergenceNote: string;
  shadowbanRate: number;
  shadowbanNote: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.reachLift}</p>
        <p className="text-3xl font-extrabold text-[#CA7F16] mt-1">
          {reachLift > 0 ? `+${reachLift.toFixed(1)}%` : `${reachLift.toFixed(1)}%`}
        </p>
        <p className="text-xs text-green-600 mt-1 flex items-center">{reachLiftComparison}</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.computeSavings}</p>
        <p className="text-3xl font-extrabold text-gray-900 mt-1">${computeSavings.toFixed(2)}</p>
        <p className="text-xs text-gray-500 mt-1">{computeSavingsNote}</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.hookDivergence}</p>
        <p className="text-3xl font-extrabold text-indigo-600 mt-1">{hookDivergence.toFixed(3)} JSD</p>
        <p className="text-xs text-gray-500 mt-1">{divergenceNote}</p>
      </div>

      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{dict.shadowbanAvoidance}</p>
        <p className="text-3xl font-extrabold text-emerald-600 mt-1">{shadowbanRate.toFixed(1)}%</p>
        <p className="text-xs text-gray-500 mt-1">{shadowbanNote}</p>
      </div>
    </div>
  );
}

function PlatformMatrixTable({
  dict,
  platformMatrix,
}: {
  dict: DictType;
  platformMatrix: ArbitragePlatformRow[];
}) {
  return (
    <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">{dict.matrixTitle}</h2>
        <span className="text-xs text-gray-400">{dict.autopilotActive}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-700">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase bg-gray-50">
              <th className="py-3 px-4">{dict.colPlatform}</th>
              <th className="py-3 px-4">{dict.colMetric}</th>
              <th className="py-3 px-4">{dict.colScore}</th>
              <th className="py-3 px-4">{dict.colMutation}</th>
              <th className="py-3 px-4">{dict.colStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {platformMatrix.map((row, idx) => (
              <tr key={`${row.platform}-${idx}`} className="hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4 font-semibold flex items-center space-x-2">
                  {getPlatformDot(row.platform)}
                  <span>{row.name}</span>
                </td>
                <td className="py-3 px-4 text-xs text-gray-600">{row.governingMetric}</td>
                <td className={`py-3 px-4 font-mono font-bold ${getScoreColor(row.platform)}`}>
                  {row.calculatedScore.toFixed(3)}
                </td>
                <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate" title={row.hookMutation}>
                  {row.hookMutation}
                </td>
                <td className="py-3 px-4">{getStatusBadge(row.status, dict)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OpportunisticComputeHudCard({
  dict,
  regimeBadge,
  regimeDesc,
  heygenDispatched,
  heygenCapacity,
  didDispatched,
  didCapacity,
  circuitBreakerStatus,
}: {
  dict: DictType;
  regimeBadge: string;
  regimeDesc: string;
  heygenDispatched: number;
  heygenCapacity: number;
  didDispatched: number;
  didCapacity: number;
  circuitBreakerStatus: string;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
      <h2 className="text-base font-bold text-gray-900">{dict.computeTitle}</h2>

      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <div className="flex items-center justify-between text-xs text-amber-900 font-semibold mb-1">
          <span>{dict.computeRegime}</span>
          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-bold">
            {regimeBadge}
          </span>
        </div>
        <p className="text-xs text-amber-800 leading-relaxed">{regimeDesc}</p>
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-gray-600">{dict.heygenLabel}</span>
            <span className="font-bold font-mono text-gray-900">
              {heygenDispatched} {dict.heygenDispatchedSuffix}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-[#CA7F16] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${heygenCapacity}%` }}
              role="progressbar"
              aria-valuenow={heygenCapacity}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-gray-600">{dict.didLabel}</span>
            <span className="font-bold font-mono text-gray-900">
              {didDispatched} {dict.didDispatchedSuffix}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${didCapacity}%` }}
              role="progressbar"
              aria-valuenow={didCapacity}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-100">
          <span className="text-gray-600">{dict.circuitBreaker}</span>
          <span className="text-emerald-600 font-bold tracking-tight">
            {circuitBreakerStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ArbitrageCard({
  data,
  locale = 'en',
  onRecalibrate,
  onExecute,
  className = '',
}: ArbitrageCardProps) {
  const dict = locale === 'vi' ? DICTIONARY.vi : DICTIONARY.en;

  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const reachLift = data?.reachLiftPercentage ?? 34.8;
  const reachLiftComparison = data?.reachLiftComparison ?? dict.reachLiftComparison;
  const computeSavings = data?.computeSavingsUsd ?? 418.5;
  const computeSavingsNote = data?.computeSavingsNote ?? dict.computeSavingsNote;
  const hookDivergence = data?.activeHookDivergenceJsd ?? 0.142;
  const divergenceNote = data?.divergenceNote ?? dict.hookDivergenceNote;
  const shadowbanRate = data?.shadowbanAvoidanceRate ?? 99.8;
  const shadowbanNote = data?.shadowbanNote ?? dict.shadowbanNote;

  const platformMatrix = data?.platformMatrix ?? DEFAULT_PLATFORM_MATRIX;

  const regimeBadge = data?.computeHud?.regime ?? dict.regimeOffPeak;
  const regimeDesc = data?.computeHud?.regimeDescription ?? dict.regimeOffPeakDesc;
  const heygenDispatched = data?.computeHud?.heygenDispatched ?? 18;
  const heygenCapacity = data?.computeHud?.heygenCapacityPercent ?? 75;
  const didDispatched = data?.computeHud?.didDispatched ?? 42;
  const didCapacity = data?.computeHud?.didCapacityPercent ?? 45;
  const circuitBreakerStatus = data?.computeHud?.circuitBreakerStatus ?? dict.circuitBreakerHealthy;

  const handleRecalibrate = async () => {
    try {
      setIsRecalibrating(true);
      setFeedback(null);
      if (onRecalibrate) {
        await onRecalibrate();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setFeedback(dict.actionSuccess);
    } catch {
      // Graceful handling without console.error
    } finally {
      setIsRecalibrating(false);
    }
  };

  const handleExecute = async () => {
    try {
      setIsExecuting(true);
      setFeedback(null);
      if (onExecute) {
        await onExecute();
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      setFeedback(dict.actionSuccess);
    } catch {
      // Graceful handling without console.error
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className={`max-w-6xl mx-auto space-y-6 text-[#1C1C28] ${className}`}>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full border border-amber-300">
              {dict.badge}
            </span>
            <span className="text-xs text-gray-500">{dict.liveOptimization}</span>
          </div>
          <h1 className="text-2xl font-bold mt-1 text-gray-900">{dict.title}</h1>
          <p className="text-sm text-gray-600 mt-0.5">{dict.subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleRecalibrate}
            disabled={isRecalibrating || isExecuting}
            className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isRecalibrating ? dict.recalibrating : dict.recalibrateAll}
          </button>
          <button
            type="button"
            onClick={handleExecute}
            disabled={isExecuting || isRecalibrating}
            className="px-4 py-2 text-sm font-medium text-white bg-[#CA7F16] hover:bg-[#CC8C33] rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            {isExecuting ? dict.executing : dict.executeArbitrage}
          </button>
        </div>
      </header>

      {feedback && (
        <div className="p-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
          {feedback}
        </div>
      )}

      <ArbitrageKpiRow
        dict={dict}
        reachLift={reachLift}
        reachLiftComparison={reachLiftComparison}
        computeSavings={computeSavings}
        computeSavingsNote={computeSavingsNote}
        hookDivergence={hookDivergence}
        divergenceNote={divergenceNote}
        shadowbanRate={shadowbanRate}
        shadowbanNote={shadowbanNote}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PlatformMatrixTable dict={dict} platformMatrix={platformMatrix} />
        <OpportunisticComputeHudCard
          dict={dict}
          regimeBadge={regimeBadge}
          regimeDesc={regimeDesc}
          heygenDispatched={heygenDispatched}
          heygenCapacity={heygenCapacity}
          didDispatched={didDispatched}
          didCapacity={didCapacity}
          circuitBreakerStatus={circuitBreakerStatus}
        />
      </div>
    </div>
  );
}
