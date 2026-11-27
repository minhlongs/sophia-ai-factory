/**
 * Declarative BE-to-FE Studio Capability Registry (Sophia UI/UX 2026 Core Kit).
 *
 * Clean-room schema-driven contract inspired by `openstatusHQ/data-table-filters`
 * (MIT), `vantezzen/autoform` (MIT), and `dip/cmdk` (MIT).
 *
 * Every Round 21+ backend engine registers ONE `StudioCapabilitySpec` here and
 * automatically renders in the KPI Strip, ⌘K Command Palette, and Progressive
 * Disclosure Inspector Drawer in both VI & EN with zero layout drift.
 *
 * Layer: seed/ui (pure isomorphic data & filter helpers, zero React/DOM deps)
 *
 * @module seed/ui/studio-capability-registry
 */

export type CapabilityCategory = 'video' | 'affiliate' | 'compliance' | 'analytics' | 'security';
export type CapabilityStatus = 'live' | 'beta' | 'guarded';

export interface BilingualText {
  readonly vi: string;
  readonly en: string;
}

export interface CapabilityFieldSpec {
  readonly key: string;
  readonly label: BilingualText;
  readonly value: string;
  readonly tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export interface StudioCapabilitySpec {
  readonly id: string;
  readonly round: number;
  readonly category: CapabilityCategory;
  readonly status: CapabilityStatus;
  /** True = shown in default non-tech Simple Mode; false = Pro/R&D Inspector only. */
  readonly simpleModeVisible: boolean;
  readonly title: BilingualText;
  readonly summary: BilingualText;
  readonly kpiLabel: BilingualText;
  readonly kpiValue: string;
  readonly routeHref?: string;
  readonly modulePath: string;
  readonly inspectorFields: readonly CapabilityFieldSpec[];
  readonly keywords: readonly string[];
}

export const SOPHIA_STUDIO_CAPABILITIES: readonly StudioCapabilitySpec[] = [
  {
    id: 'policy-preflight-engine',
    round: 1,
    category: 'compliance',
    status: 'live',
    simpleModeVisible: true,
    title: { vi: 'Kiểm Duyệt Luật Sàn & Crypto', en: 'Policy Preflight Engine' },
    summary: {
      vi: 'Tự động rà soát kịch bản theo luật TikTok, YouTube, FTC, FCA, MiCA và VN trước khi xuất video.',
      en: 'Pre-checks scripts against TikTok, YouTube, FTC, FCA, MiCA, and VN rules before rendering.',
    },
    kpiLabel: { vi: 'Ma trận luật', en: 'Rule Matrix' },
    kpiValue: '4-Axis',
    routeHref: '/dashboard/pilot-studio',
    modulePath: 'seed/compliance/policy-preflight-engine.ts',
    inspectorFields: [
      { key: 'scope', label: { vi: 'Phạm vi', en: 'Coverage' }, value: 'FTC / FCA / MiCA / VN', tone: 'success' },
      { key: 'mode', label: { vi: 'Chế độ', en: 'Mode' }, value: 'Pre-render Gate', tone: 'neutral' },
    ],
    keywords: ['policy', 'compliance', 'luật', 'crypto', 'ftc', 'mica'],
  },
  {
    id: 'webcodecs-timeline-spec',
    round: 2,
    category: 'video',
    status: 'live',
    simpleModeVisible: true,
    title: { vi: 'Xuất Video Trình Duyệt 30fps', en: 'WebCodecs 30fps Browser Renderer' },
    summary: {
      vi: 'Ghép giọng đọc, phụ đề karaoke và hiệu ứng chuyển động ngay trên trình duyệt với $0 chi phí GPU.',
      en: 'Muxes TTS audio, karaoke captions, and Ken Burns motion in-browser at $0 GPU cost.',
    },
    kpiLabel: { vi: 'Chi phí GPU', en: 'GPU COGS' },
    kpiValue: '$0',
    routeHref: '/dashboard/pilot-studio',
    modulePath: 'seed/video/webcodecs-timeline-spec.ts',
    inspectorFields: [
      { key: 'fps', label: { vi: 'Khung hình', en: 'Framerate' }, value: '30 fps / 1080x1920', tone: 'success' },
      { key: 'tts', label: { vi: 'Âm thanh', en: 'Audio' }, value: 'Browser TTS + Device Probe', tone: 'neutral' },
    ],
    keywords: ['video', 'mp4', 'webcodecs', 'render', 'tts', 'karaoke'],
  },
  {
    id: 'hook-beat-evaluator',
    round: 8,
    category: 'video',
    status: 'live',
    simpleModeVisible: true,
    title: { vi: 'Chấm Điểm 3 Giây Mở Đầu', en: '3-Second Hook Beat Evaluator' },
    summary: {
      vi: 'Đo độ giữ chân 3 giây đầu và nhịp câu để tối ưu tỷ lệ xem hết video ngắn.',
      en: 'Scores 3-second retention hooks and pacing beats to maximize short-form completion.',
    },
    kpiLabel: { vi: 'Ngưỡng đạt', en: 'Pass Threshold' },
    kpiValue: '75/100',
    routeHref: '/dashboard/pilot-studio',
    modulePath: 'seed/ai/hook-beat-evaluator.ts',
    inspectorFields: [
      { key: 'window', label: { vi: 'Khung đo', en: 'Window' }, value: '0.0s – 3.0s', tone: 'neutral' },
      { key: 'repair', label: { vi: 'Tự sửa JSON', en: 'SAP Repair' }, value: 'Active', tone: 'success' },
    ],
    keywords: ['hook', 'retention', '3s', 'script', 'kịch bản'],
  },
  {
    id: 'thompson-bandit-engine',
    round: 17,
    category: 'analytics',
    status: 'live',
    simpleModeVisible: true,
    title: { vi: 'Tự Chọn Phiên Bản Thắng A/B', en: 'Thompson Bandit A/B Optimizer' },
    summary: {
      vi: 'Tự động dồn traffic về biến thể video/offer có EPC cao nhất mà không cần chỉnh tay.',
      en: 'Automatically shifts traffic toward the highest-EPC creative variant.',
    },
    kpiLabel: { vi: 'Thuật toán', en: 'Algorithm' },
    kpiValue: 'Beta-Bernoulli',
    routeHref: '/dashboard/analytics',
    modulePath: 'seed/ai/thompson-bandit-engine.ts',
    inspectorFields: [
      { key: 'objective', label: { vi: 'Mục tiêu', en: 'Objective' }, value: 'Maximize EPC', tone: 'success' },
      { key: 'coldstart', label: { vi: 'Khởi tạo', en: 'Prior' }, value: 'Uniform (1, 1)', tone: 'neutral' },
    ],
    keywords: ['ab', 'bandit', 'epc', 'winner', 'tối ưu'],
  },
  {
    id: 'epc-anomaly-detector',
    round: 18,
    category: 'analytics',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Cảnh Báo Tụt EPC Bất Thường', en: 'EPC Anomaly Detector' },
    summary: {
      vi: 'Phát hiện sụt giảm tỷ lệ chuyển đổi hoặc link affiliate chết theo Z-score thời gian thực.',
      en: 'Detects sudden EPC drops or broken affiliate links via real-time Z-score telemetry.',
    },
    kpiLabel: { vi: 'Độ nhạy', en: 'Sensitivity' },
    kpiValue: 'Z ≤ -2.0',
    routeHref: '/dashboard/analytics',
    modulePath: 'seed/analytics/epc-anomaly-detector.ts',
    inspectorFields: [
      { key: 'signal', label: { vi: 'Tín hiệu', en: 'Signal' }, value: 'Rolling EPC Z-Score', tone: 'warning' },
      { key: 'action', label: { vi: 'Phản ứng', en: 'Action' }, value: 'Alert + Pause Offer', tone: 'neutral' },
    ],
    keywords: ['epc', 'anomaly', 'cảnh báo', 'z-score', 'drop'],
  },
  {
    id: 'asn-click-fraud-shield',
    round: 8,
    category: 'security',
    status: 'guarded',
    simpleModeVisible: false,
    title: { vi: 'Khiên Lọc Bot & Click Ảo ASN', en: 'ASN Click-Fraud & Bot Shield' },
    summary: {
      vi: 'Chặn crawler preview (Telegram/X/Meta) và datacenter ASN để số liệu EPC sạch 100%.',
      en: 'Filters preview crawlers and datacenter ASNs at the edge so EPC stays 100% clean.',
    },
    kpiLabel: { vi: 'Tầng lọc', en: 'Edge Layer' },
    kpiValue: 'CF ASN + UA',
    modulePath: 'seed/security/asn-click-fraud-shield.ts',
    inspectorFields: [
      { key: 'source', label: { vi: 'Nguồn ASN', en: 'ASN Source' }, value: 'Trusted request.cf.asn', tone: 'success' },
      { key: 'latency', label: { vi: 'Độ trễ', en: 'Overhead' }, value: '<1ms Edge', tone: 'neutral' },
    ],
    keywords: ['bot', 'fraud', 'asn', 'security', 'click', 'bảo mật'],
  },
  {
    id: 'creator-va-rbac',
    round: 19,
    category: 'security',
    status: 'guarded',
    simpleModeVisible: false,
    title: { vi: 'Phân Quyền VA Khóa Link Affiliate', en: 'Creator-VA Fail-Closed RBAC' },
    summary: {
      vi: 'Cho phép VA sửa kịch bản và dựng video nhưng khóa cứng URL affiliate & payout của chủ sở hữu.',
      en: 'Lets VA editors draft scripts and videos while locking owner referral URLs via allowlist.',
    },
    kpiLabel: { vi: 'Chính sách', en: 'Policy' },
    kpiValue: 'Fail-Closed',
    modulePath: 'seed/security/creator-va-rbac.ts',
    inspectorFields: [
      { key: 'model', label: { vi: 'Cơ chế', en: 'Enforcement' }, value: 'Explicit Allowlist + Map', tone: 'success' },
      { key: 'locked', label: { vi: 'Bảo vệ', en: 'Protected' }, value: 'referralUrl, shortCode, payout', tone: 'warning' },
    ],
    keywords: ['rbac', 'va', 'permission', 'phân quyền', 'link'],
  },
  {
    id: 'autogeo-citation-rules',
    round: 7,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Tối Ưu Trích Dẫn AI (AutoGEO)', en: 'AutoGEO Citation & x402 Contract' },
    summary: {
      vi: 'Chuẩn hóa trang so sánh và Media Kit ký số để AI Search (Perplexity/ChatGPT) ưu tiên trích dẫn.',
      en: 'Structures comparison pages and signed Media Kits for high AI Search citation rates.',
    },
    kpiLabel: { vi: 'Chuẩn ký', en: 'Attestation' },
    kpiValue: 'HS256 JWS',
    routeHref: '/dashboard/pilot-studio',
    modulePath: 'seed/aeo/autogeo-citation-rules.ts',
    inspectorFields: [
      { key: 'agent', label: { vi: 'Khám phá', en: 'Discovery' }, value: '/.well-known/agent.json', tone: 'success' },
      { key: 'hub', label: { vi: 'Trang đích', en: 'Surface' }, value: '/hub/[slug] + /compare/[slug]', tone: 'neutral' },
    ],
    keywords: ['geo', 'aeo', 'citation', 'media kit', 'x402', 'compare'],
  },
];

export function filterCapabilities(
  capabilities: readonly StudioCapabilitySpec[],
  options: {
    readonly query?: string;
    readonly category?: CapabilityCategory | 'all';
    readonly inspectorMode?: boolean;
  },
): readonly StudioCapabilitySpec[] {
  const normalizedQuery = (options.query ?? '').trim().toLowerCase();
  const category = options.category ?? 'all';
  const inspectorMode = options.inspectorMode ?? false;

  return capabilities.filter((cap) => {
    if (!inspectorMode && !cap.simpleModeVisible) {
      return false;
    }
    if (category !== 'all' && cap.category !== category) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const haystack = [
      cap.id,
      cap.title.vi,
      cap.title.en,
      cap.summary.vi,
      cap.summary.en,
      cap.kpiValue,
      ...cap.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
