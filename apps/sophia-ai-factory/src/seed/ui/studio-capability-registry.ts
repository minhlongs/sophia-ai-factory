/**
 * Declarative BE-to-FE Studio Capability Registry (Sophia UI/UX 2026 Core Kit).
 *
 * Clean-room schema-driven contract inspired by `openstatusHQ/data-table-filters`
 * (MIT), `vantezzen/autoform` (MIT), and `dip/cmdk` (MIT).
 *
 * Covers 100% of live backend engines ported across Rounds 1–19 (18 engines).
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
    routeHref: '/dashboard/engines',
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
    routeHref: '/dashboard/engines',
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
    routeHref: '/dashboard/engines',
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
    routeHref: '/dashboard/engines',
    modulePath: 'seed/ai/thompson-bandit-engine.ts',
    inspectorFields: [
      { key: 'objective', label: { vi: 'Mục tiêu', en: 'Objective' }, value: 'Maximize EPC', tone: 'success' },
      { key: 'coldstart', label: { vi: 'Khởi tạo', en: 'Prior' }, value: 'Uniform (1, 1)', tone: 'neutral' },
    ],
    keywords: ['ab', 'bandit', 'epc', 'winner', 'tối ưu'],
  },
  {
    id: 'bot-user-agent-filter',
    round: 3,
    category: 'security',
    status: 'guarded',
    simpleModeVisible: false,
    title: { vi: 'Lọc Bot Preview Link Rút Gọn', en: 'Shortlink Bot-UA Filter' },
    summary: {
      vi: 'Loại bỏ crawler xem trước từ Telegram, X, Meta để không làm nhiễu số liệu click affiliate.',
      en: 'Filters Telegram, X, and Meta preview crawlers from corrupting affiliate click counts.',
    },
    kpiLabel: { vi: 'Độ sạch Click', en: 'Click Hygiene' },
    kpiValue: 'Edge UA',
    modulePath: 'seed/security/bot-user-agent.ts',
    inspectorFields: [
      { key: 'route', label: { vi: 'Điểm gắn', en: 'Hook' }, value: '/api/r/[code]', tone: 'success' },
    ],
    keywords: ['bot', 'ua', 'shortlink', 'crawler', 'click'],
  },
  {
    id: 'schema-aligned-repair',
    round: 3,
    category: 'compliance',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Tự Sửa JSON Kịch Bản (SAP)', en: 'Schema-Aligned JSON Repair' },
    summary: {
      vi: 'Tự làm sạch markdown fence & lỗi cú pháp JSON từ LLM giúp tiết kiệm 30–50% credit BYOK.',
      en: 'Repairs malformed LLM JSON and markdown fences before Zod parsing to cut BYOK waste.',
    },
    kpiLabel: { vi: 'Tiết kiệm BYOK', en: 'BYOK Savings' },
    kpiValue: '30–50%',
    modulePath: 'seed/security/schema-aligned-repair.ts',
    inspectorFields: [
      { key: 'stage', label: { vi: 'Giai đoạn', en: 'Stage' }, value: 'Pre-Zod Repair', tone: 'success' },
    ],
    keywords: ['sap', 'json', 'repair', 'byok', 'zod'],
  },
  {
    id: 'delayed-comment-plug',
    round: 4,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Gắn Link Affiliate Bình Luận Đầu', en: 'Delayed First-Comment Plug' },
    summary: {
      vi: 'Tự động thả link affiliate ở bình luận đầu tiên sau khi đăng để tránh bị X/TikTok bóp reach.',
      en: 'Posts affiliate links as a delayed first comment so platforms do not throttle organic reach.',
    },
    kpiLabel: { vi: 'Tránh bóp reach', en: 'Reach Guard' },
    kpiValue: 'Async Plug',
    routeHref: '/dashboard/publish/queue',
    modulePath: 'forest/publishing/delayed-comment-plug.ts',
    inspectorFields: [
      { key: 'queue', label: { vi: 'Hàng đợi', en: 'Queue' }, value: '/dashboard/publish/queue', tone: 'neutral' },
    ],
    keywords: ['comment', 'plug', 'reach', 'publish', 'bình luận'],
  },
  {
    id: 'content-atomizer',
    round: 7,
    category: 'video',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Tách 1 Kịch Bản Thành Đa Kênh', en: 'Omnichannel Content Atomizer' },
    summary: {
      vi: 'Biến 1 chiến dịch gốc thành gói TikTok, Reels, YouTube Shorts, X Thread và Telegram đồng bộ.',
      en: 'Atomizes one master campaign into TikTok, Reels, Shorts, X Thread, and Telegram assets.',
    },
    kpiLabel: { vi: 'Kênh xuất', en: 'Channels' },
    kpiValue: '5+ Formats',
    routeHref: '/dashboard/engines',
    modulePath: 'seed/ai/content-atomizer.ts',
    inspectorFields: [
      { key: 'pack', label: { vi: 'Đầu ra', en: 'Output' }, value: 'CapCut + Social Pack', tone: 'success' },
    ],
    keywords: ['atomizer', 'omnichannel', 'đa kênh', 'tiktok', 'shorts'],
  },
  {
    id: 'autogeo-citation-rules',
    round: 7,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Tối Ưu Trích Dẫn AI (AutoGEO)', en: 'AutoGEO Citation & x402 Contract' },
    summary: {
      vi: 'Chuẩn hóa trang so sánh và hợp đồng x402 để AI Search (Perplexity/ChatGPT) ưu tiên trích dẫn.',
      en: 'Structures comparison pages and x402 contracts for high AI Search citation rates.',
    },
    kpiLabel: { vi: 'Khám phá AI', en: 'Agent Discovery' },
    kpiValue: 'agent.json',
    routeHref: '/dashboard/engines',
    modulePath: 'seed/aeo/autogeo-citation-rules.ts',
    inspectorFields: [
      { key: 'agent', label: { vi: 'Manifest', en: 'Manifest' }, value: '/.well-known/agent.json', tone: 'success' },
      { key: 'hub', label: { vi: 'Trang đích', en: 'Surface' }, value: '/hub/[slug] + /compare/[slug]', tone: 'neutral' },
    ],
    keywords: ['geo', 'aeo', 'citation', 'x402', 'compare'],
  },
  {
    id: 'asn-click-fraud-shield',
    round: 8,
    category: 'security',
    status: 'guarded',
    simpleModeVisible: false,
    title: { vi: 'Khiên Lọc Click Ảo Datacenter ASN', en: 'ASN Click-Fraud Shield' },
    summary: {
      vi: 'Chặn datacenter ASN trực tiếp từ Cloudflare request.cf.asn để bảo vệ số liệu EPC.',
      en: 'Blocks datacenter ASNs using trusted Cloudflare request.cf.asn at the edge.',
    },
    kpiLabel: { vi: 'Tầng lọc', en: 'Edge Layer' },
    kpiValue: 'CF ASN',
    modulePath: 'seed/security/asn-click-fraud-shield.ts',
    inspectorFields: [
      { key: 'source', label: { vi: 'Nguồn ASN', en: 'ASN Source' }, value: 'Trusted request.cf.asn', tone: 'success' },
    ],
    keywords: ['fraud', 'asn', 'security', 'click', 'bảo mật'],
  },
  {
    id: 'timeline-isolated-srt',
    round: 9,
    category: 'video',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Đồng Bộ Phụ Đề SRT Chuẩn Khung', en: 'Timeline-Isolated SRT Builder' },
    summary: {
      vi: 'Sinh phụ đề SRT khớp từng phân cảnh giúp xuất CapCut và WebCodecs không lệch tiếng.',
      en: 'Generates frame-accurate scene-isolated SRT captions for CapCut and WebCodecs.',
    },
    kpiLabel: { vi: 'Định dạng', en: 'Format' },
    kpiValue: 'SRT v1',
    modulePath: 'seed/video/timeline-isolated-srt.ts',
    inspectorFields: [
      { key: 'sync', label: { vi: 'Khớp nhịp', en: 'Sync' }, value: 'Scene-Isolated', tone: 'success' },
    ],
    keywords: ['srt', 'subtitle', 'phụ đề', 'capcut', 'timeline'],
  },
  {
    id: 'youtube-preflight-validator',
    round: 9,
    category: 'compliance',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Kiểm Tra Quy Chuẩn YouTube Shorts', en: 'YouTube Preflight Validator' },
    summary: {
      vi: 'Kiểm tra tỷ lệ 9:16, thời lượng ≤60s và metadata trước khi đẩy lên YouTube.',
      en: 'Validates 9:16 aspect ratio, ≤60s duration, and metadata before YouTube upload.',
    },
    kpiLabel: { vi: 'Chuẩn Shorts', en: 'Shorts Gate' },
    kpiValue: '9:16 ≤60s',
    modulePath: 'seed/video/youtube-preflight-validator.ts',
    inspectorFields: [
      { key: 'check', label: { vi: 'Kiểm tra', en: 'Checks' }, value: 'Duration, Ratio, Disclosure', tone: 'neutral' },
    ],
    keywords: ['youtube', 'shorts', 'preflight', 'validator'],
  },
  {
    id: 'capi-webhook-verifier',
    round: 10,
    category: 'security',
    status: 'guarded',
    simpleModeVisible: false,
    title: { vi: 'Xác Thực Chữ Ký CAPI & Webhook', en: 'HMAC CAPI & Webhook Verifier' },
    summary: {
      vi: 'Xác thực chữ ký HMAC constant-time kèm cửa sổ chống replay 300 giây cho postback.',
      en: 'Constant-time HMAC verification with 300s replay protection for conversion webhooks.',
    },
    kpiLabel: { vi: 'Chống Replay', en: 'Replay Window' },
    kpiValue: '300s XOR',
    modulePath: 'seed/compliance/capi-and-webhook-verifier.ts',
    inspectorFields: [
      { key: 'algo', label: { vi: 'Thuật toán', en: 'Crypto' }, value: 'Constant-Time HMAC', tone: 'success' },
    ],
    keywords: ['capi', 'webhook', 'hmac', 'postback', 'security'],
  },
  {
    id: 'verified-media-kit',
    round: 11,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Media Kit Ký Số Xác Minh Doanh Thu', en: 'Verified JWS Media Kit' },
    summary: {
      vi: 'Cấp chứng nhận hiệu suất affiliate ký HS256 JWS để đàm phán hoa hồng cao với sàn.',
      en: 'Issues HS256 JWS-signed performance attestations to negotiate higher affiliate tiers.',
    },
    kpiLabel: { vi: 'Chữ ký số', en: 'Signature' },
    kpiValue: 'HS256 JWS',
    modulePath: 'seed/aeo/verified-media-kit-attestation.ts',
    inspectorFields: [
      { key: 'endpoint', label: { vi: 'API', en: 'Endpoint' }, value: '/api/media-kit/[slug]', tone: 'success' },
    ],
    keywords: ['media kit', 'jws', 'attestation', 'chứng nhận'],
  },
  {
    id: 'concierge-funnel-fsm',
    round: 12,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Phễu Hội Thoại Telegram & Discord', en: 'Telegram & Discord Concierge FSM' },
    summary: {
      vi: 'Tự động dẫn dắt khách high-ticket qua hội thoại Telegram/Discord đến đúng offer phù hợp.',
      en: 'Guides high-ticket prospects through interactive Telegram/Discord qualification flows.',
    },
    kpiLabel: { vi: 'Kênh chat', en: 'Chat Channels' },
    kpiValue: 'TG + Discord',
    modulePath: 'seed/telegram/concierge-funnel-fsm.ts',
    inspectorFields: [
      { key: 'webhook', label: { vi: 'Discord API', en: 'Discord API' }, value: '/api/webhooks/discord/interactions', tone: 'neutral' },
    ],
    keywords: ['telegram', 'discord', 'concierge', 'funnel', 'phễu'],
  },
  {
    id: 'carousel-svg-builder',
    round: 13,
    category: 'video',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Sinh Slide Carousel SVG Tự Động', en: 'Carousel SVG Slide Builder' },
    summary: {
      vi: 'Tạo bộ slide carousel sắc nét không cần Figma/Canva cho LinkedIn, TikTok Photo và X.',
      en: 'Generates crisp SVG carousel slides for LinkedIn, TikTok Photo, and X without Figma.',
    },
    kpiLabel: { vi: 'Đầu ra', en: 'Endpoint' },
    kpiValue: 'SVG Edge',
    modulePath: 'seed/video/carousel-svg-builder.ts',
    inspectorFields: [
      { key: 'api', label: { vi: 'API', en: 'API' }, value: '/api/media/carousel-svg', tone: 'success' },
    ],
    keywords: ['carousel', 'svg', 'slide', 'linkedin'],
  },
  {
    id: 'comment-pain-point-miner',
    round: 16,
    category: 'analytics',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Khai Thác Nỗi Đau Từ Bình Luận', en: 'Comment Pain-Point Miner' },
    summary: {
      vi: 'Gom nhóm câu hỏi và nỗi đau lặp lại trong bình luận thành ý tưởng hook chuyển đổi cao.',
      en: 'Clusters recurring audience pain points from comments into high-converting hooks.',
    },
    kpiLabel: { vi: 'Nguồn ý tưởng', en: 'Signal' },
    kpiValue: 'Pain Cluster',
    modulePath: 'seed/ai/comment-pain-point-miner.ts',
    inspectorFields: [
      { key: 'surface', label: { vi: 'Tích hợp', en: 'Surface' }, value: '/compare/[slug] + Script AI', tone: 'neutral' },
    ],
    keywords: ['comment', 'pain', 'miner', 'hook', 'bình luận'],
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
    routeHref: '/dashboard/engines',
    modulePath: 'seed/analytics/epc-anomaly-detector.ts',
    inspectorFields: [
      { key: 'signal', label: { vi: 'Tín hiệu', en: 'Signal' }, value: 'Rolling EPC Z-Score', tone: 'warning' },
      { key: 'action', label: { vi: 'Phản ứng', en: 'Action' }, value: 'Alert + Pause Offer', tone: 'neutral' },
    ],
    keywords: ['epc', 'anomaly', 'cảnh báo', 'z-score', 'drop'],
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
    id: 'cookieless-attribution',
    round: 21,
    category: 'analytics',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Đo Lường Không Cookie & Postback S2S', en: 'Cookieless First-Party Attribution' },
    summary: {
      vi: 'Truyền click_id trực tiếp qua URL không cần cookie bên thứ 3 và chia điểm đa chạm 40/20/40.',
      en: 'Zero-cookie URL click_id propagation with deterministic 40/20/40 multi-touch attribution.',
    },
    kpiLabel: { vi: 'Cookie', en: '3P Cookies' },
    kpiValue: 'Zero',
    modulePath: 'seed/analytics/cookieless-attribution.ts',
    inspectorFields: [
      { key: 'model', label: { vi: 'Mô hình', en: 'Model' }, value: '40/20/40 U-Shaped', tone: 'success' },
    ],
    keywords: ['attribution', 'cookieless', 'postback', 'utm', 'subid'],
  },
  {
    id: 'frame1-hook-scorer',
    round: 22,
    category: 'video',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Kiểm Tra Vùng An Toàn Khung Hình Đầu', en: 'Frame-1 Safe-Zone & WCAG Scorer' },
    summary: {
      vi: 'Kiểm tra chữ không bị che bởi nút TikTok/Shorts/Reels và độ tương phản WCAG 2.2 ở 0ms.',
      en: 'Validates 9:16 TikTok/Shorts/Reels UI dead zones and WCAG 2.2 contrast at $0 GPU COGS.',
    },
    kpiLabel: { vi: 'Chi phí GPU', en: 'GPU COGS' },
    kpiValue: '$0 / 0ms',
    modulePath: 'seed/video/frame1-hook-scorer.ts',
    inspectorFields: [
      { key: 'wcag', label: { vi: 'Tương phản', en: 'Contrast' }, value: 'WCAG AA ≥ 4.5:1', tone: 'success' },
    ],
    keywords: ['thumbnail', 'frame1', 'safe-zone', 'wcag', 'contrast'],
  },
  {
    id: 'geo-failover-router',
    round: 23,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Chuyển Hướng Quốc Gia & Tự Đổi Link Chết', en: 'Edge Geo-Routing & Offer Failover' },
    summary: {
      vi: 'Tự đổi sang offer dự phòng khi khách ở quốc gia bị chặn (US/UK) hoặc link đích lỗi 404/5xx.',
      en: 'Auto-fails over geo-blocked (US/UK) or circuit-open affiliate offers while ignoring WAF 403.',
    },
    kpiLabel: { vi: 'Định tuyến', en: 'Edge Geo' },
    kpiValue: 'cf.country',
    modulePath: 'seed/affiliate/geo-failover-router.ts',
    inspectorFields: [
      { key: 'waf', label: { vi: 'Chống báo giả', en: 'WAF Guard' }, value: 'Ignores 401/403/429', tone: 'success' },
    ],
    keywords: ['geo', 'failover', 'country', 'circuit-breaker', 'link'],
  },
  {
    id: 'creator-cadence-engine',
    round: 24,
    category: 'analytics',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Nhịp Đăng Bài Chống Spam & Burnout', en: 'Creator Cadence & Anti-Burnout' },
    summary: {
      vi: 'Giới hạn số bài/ngày chống bóp reach, dời bài dư sang ngày mai và ngắt mạch khi sàn cảnh báo.',
      en: 'Enforces burst-deferring daily caps, streak grace tokens, and action-block circuit breakers.',
    },
    kpiLabel: { vi: 'Chống Spam', en: 'Pacing' },
    kpiValue: 'Burst Defer',
    modulePath: 'seed/growth/creator-cadence-engine.ts',
    inspectorFields: [
      { key: 'breaker', label: { vi: 'Ngắt mạch', en: 'Breaker' }, value: 'Non-Auto-Resuming', tone: 'warning' },
    ],
    keywords: ['cadence', 'streak', 'burnout', 'schedule', 'spam'],
  },
  {
    id: 'integer-cent-waterfall',
    round: 25,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Sổ Cái Chia Hoa Hồng 70/20/10 (0 Sai Số)', en: 'Integer-Cent Revenue Split Waterfall' },
    summary: {
      vi: 'Chia hoa hồng Creator/VA/Agency bằng số nguyên BigInt từng cent, tuyệt đối không lệch số lẻ.',
      en: 'BigInt minor-unit 70/20/10 revenue waterfall with deterministic largest-remainder allocation.',
    },
    kpiLabel: { vi: 'Độ chính xác', en: 'Precision' },
    kpiValue: 'BigInt Cent',
    modulePath: 'seed/finance/integer-cent-waterfall.ts',
    inspectorFields: [
      { key: 'drift', label: { vi: 'Sai số', en: 'Float Drift' }, value: '0.00 (Guaranteed)', tone: 'success' },
    ],
    keywords: ['ledger', 'waterfall', 'split', 'payout', 'bigint', 'agency'],
  },
  {
    id: 'kinetic-captions',
    round: 26,
    category: 'video',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Phụ Đề Karaoke Chạy Theo Từng Từ', en: 'Word-Level Kinetic Captions' },
    summary: {
      vi: 'Tách phụ đề 2–4 từ/nhịp theo dấu câu và khoảng lặng, xuất thẻ ASS karaoke ở 0ms.',
      en: 'Chunks word tokens into 2–4 word kinetic beats and emits ASS karaoke tags at 0ms.',
    },
    kpiLabel: { vi: 'Nhịp chữ', en: 'Beat Size' },
    kpiValue: '2–4 Words',
    modulePath: 'seed/video/kinetic-captions.ts',
    inspectorFields: [
      { key: 'format', label: { vi: 'Định dạng', en: 'Format' }, value: 'ASS {\\k} + WebVTT', tone: 'success' },
    ],
    keywords: ['karaoke', 'caption', 'kinetic', 'subtitle', 'ass'],
  },
  {
    id: 'offer-drift-detector',
    round: 27,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Giám Sát Giảm Hoa Hồng & Tắt Offer', en: 'Offer Commission Drift Monitor' },
    summary: {
      vi: 'Cảnh báo ngay khi sàn cắt % hoa hồng (30%→15%), rút ngắn cookie hoặc tắt chương trình.',
      en: 'Alerts immediately on commission cuts, cookie-window shrinkage, ToS changes, or 404/410 shutdowns.',
    },
    kpiLabel: { vi: 'Chi phí AI', en: 'LLM COGS' },
    kpiValue: '$0 Diff',
    modulePath: 'seed/affiliate/offer-drift-detector.ts',
    inspectorFields: [
      { key: 'alerts', label: { vi: 'Cảnh báo', en: 'Alerts' }, value: 'Cut / Cookie / ToS / 410', tone: 'warning' },
    ],
    keywords: ['drift', 'commission', 'tos', 'shutdown', 'offer'],
  },
  {
    id: 'comment-to-dm-fsm',
    round: 28,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Tự Động Gửi DM Từ Từ Khóa Bình Luận', en: 'Comment-to-DM Keyword FSM' },
    summary: {
      vi: 'Khớp từ khóa tiếng Việt/Anh không dấu, tuân thủ ngưỡng 750 DM/giờ và cửa sổ 24h của Meta.',
      en: 'Diacritic-aware VI/EN comment trigger FSM respecting Meta 750/hr cap and 24h window.',
    },
    kpiLabel: { vi: 'Giới hạn Meta', en: 'Meta Cap' },
    kpiValue: '750/hr • 24h',
    modulePath: 'seed/growth/comment-to-dm-fsm.ts',
    inspectorFields: [
      { key: 'mode', label: { vi: 'Khớp chữ', en: 'Matching' }, value: 'Unicode NFD + Rate Cap', tone: 'success' },
    ],
    keywords: ['dm', 'manychat', 'comment', 'keyword', 'instagram'],
  },
  {
    id: 'byok-key-rotation',
    round: 29,
    category: 'security',
    status: 'guarded',
    simpleModeVisible: false,
    title: { vi: 'Xoay Vòng Khóa BYOK & Ẩn Mật Khẩu', en: 'Zero-Downtime BYOK Key Rotation' },
    summary: {
      vi: 'Lập kế hoạch xoay vòng khóa KEK không gián đoạn và tự ẩn sạch API key trước khi ghi log.',
      en: 'Plans multi-version KEK re-wrapping without downtime and redacts raw API keys from logs.',
    },
    kpiLabel: { vi: 'Bảo mật', en: 'Security' },
    kpiValue: 'Zero-Leak',
    modulePath: 'seed/security/byok-key-rotation.ts',
    inspectorFields: [
      { key: 'crypto', label: { vi: 'Cơ chế', en: 'Crypto' }, value: 'AES-256-GCM + Redactor', tone: 'success' },
    ],
    keywords: ['byok', 'rotation', 'kek', 'redact', 'encryption'],
  },
  {
    id: 'cross-border-payout-tax',
    round: 30,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Đối Soát Thanh Toán & Thuế Xuyên Biên Giới', en: 'Cross-Border Payout & Tax Ledger' },
    summary: {
      vi: 'Tính khấu trừ thuế và số thực nhận bằng số nguyên BigInt cho NOWPayments USDT, PayOS VND, USD.',
      en: 'Exact BigInt withholding-tax and net payout ledger for NOWPayments USDT, PayOS VND, and USD wire.',
    },
    kpiLabel: { vi: 'Cổng chi trả', en: 'Rails' },
    kpiValue: 'USDT / VND / USD',
    modulePath: 'seed/finance/cross-border-payout-tax.ts',
    inspectorFields: [
      { key: 'balance', label: { vi: 'Cân đối', en: 'Invariant' }, value: 'Tax + Net === Gross', tone: 'success' },
    ],
    keywords: ['tax', 'payout', 'nowpayments', 'payos', 'vnd', 'usdt'],
  },
  {
    id: 'broll-scene-matcher',
    round: 31,
    category: 'video',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Ghép Cảnh B-Roll Dọc 9:16 ($0 AI)', en: 'Zero-GPU 9:16 B-Roll Scene Matcher' },
    summary: {
      vi: 'Tự rút từ khóa phân cảnh và chọn clip B-roll dọc thương mại (Pexels/Pixabay/Coverr) ở 0ms.',
      en: 'Extracts scene keywords and scores vertical commercial B-roll clips at $0 LLM/GPU COGS.',
    },
    kpiLabel: { vi: 'Chi phí AI', en: 'LLM COGS' },
    kpiValue: '$0 / 0ms',
    modulePath: 'seed/video/broll-scene-matcher.ts',
    inspectorFields: [
      { key: 'ratio', label: { vi: 'Khung hình', en: 'Aspect' }, value: '9:16 Commercial Only', tone: 'success' },
    ],
    keywords: ['broll', 'pexels', 'pixabay', 'video', 'scene'],
  },
  {
    id: 'landing-preflight-linter',
    round: 32,
    category: 'compliance',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Kiểm Tra Trang Đích CRO & Luật FTC/DSA', en: 'Landing CRO & FTC/DSA Preflight Linter' },
    summary: {
      vi: 'Chấm điểm A–F cho trang đích affiliate: kiểm tra công bố FTC/DSA, JSON-LD và script chặn tải.',
      en: 'Grades affiliate landing HTML A–F for FTC/DSA disclosure, Schema JSON-LD, and blocking scripts.',
    },
    kpiLabel: { vi: 'Thang điểm', en: 'Grading' },
    kpiValue: 'A–F Static',
    modulePath: 'seed/aeo/landing-preflight-linter.ts',
    inspectorFields: [
      { key: 'rules', label: { vi: 'Chuẩn kiểm', en: 'Checks' }, value: 'FTC + DSA + CWV Proxy', tone: 'success' },
    ],
    keywords: ['cro', 'landing', 'cwv', 'ftc', 'dsa', 'json-ld'],
  },
  {
    id: 'account-warmup-fsm',
    round: 33,
    category: 'analytics',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Nuôi Kênh Mới 14 Ngày & Chống Shadowban', en: 'Account Warm-Up & Shadowban Guard' },
    summary: {
      vi: 'Tự tăng dần nhịp đăng cho kênh mới 1–14 ngày và bật cooldown 48h khi phát hiện tụt view bất thường.',
      en: 'Ramps new-account posting caps (Day 1–14) and triggers 48h cooldown on severe reach drops.',
    },
    kpiLabel: { vi: 'Bảo vệ kênh', en: 'Protection' },
    kpiValue: 'Day 1–14 Ramp',
    modulePath: 'seed/growth/account-warmup-fsm.ts',
    inspectorFields: [
      { key: 'guard', label: { vi: 'Ngưỡng tụt', en: 'Drop Gate' }, value: '≤15% Baseline → 48h Pause', tone: 'warning' },
    ],
    keywords: ['warmup', 'shadowban', 'reach', 'tiktok', 'cooldown'],
  },
  {
    id: 'byok-fallback-router',
    round: 34,
    category: 'security',
    status: 'guarded',
    simpleModeVisible: false,
    title: { vi: 'Điều Phối Đa Hãng LLM BYOK & Trần Chi Phí', en: 'BYOK LLM Fallback & Budget Guard' },
    summary: {
      vi: 'Tự chuyển giữa OpenRouter/OpenAI/Anthropic/Gemini khi gặp 429/5xx và khóa trần chi tiêu ngày.',
      en: 'Fails over across OpenRouter/OpenAI/Anthropic/Gemini on 429/5xx with hard daily cent caps.',
    },
    kpiLabel: { vi: 'Trần ngày', en: 'Spend Guard' },
    kpiValue: 'Pre-Call Cap',
    modulePath: 'seed/ai/byok-fallback-router.ts',
    inspectorFields: [
      { key: 'chain', label: { vi: 'Chuỗi hãng', en: 'Chain' }, value: 'OR → OpenAI → Claude → Gemini', tone: 'success' },
    ],
    keywords: ['byok', 'llm', 'fallback', 'budget', 'token', 'openrouter'],
  },
  {
    id: 'cohort-ltv-forecaster',
    round: 35,
    category: 'affiliate',
    status: 'live',
    simpleModeVisible: false,
    title: { vi: 'Dự Báo LTV Hoa Hồng Định Kỳ & Hoàn Vốn CAC', en: 'Cohort LTV & CAC Payback Forecaster' },
    summary: {
      vi: 'Dự báo doanh thu tích lũy SaaS/CEX theo đường cong giữ chân và tháng hoàn vốn CAC bằng BigInt.',
      en: 'Projects SaaS recurring & CEX rebate cohort LTV and exact CAC payback month using BigInt cents.',
    },
    kpiLabel: { vi: 'Độ chính xác', en: 'Precision' },
    kpiValue: 'BigInt Cohort',
    modulePath: 'seed/finance/cohort-ltv-forecaster.ts',
    inspectorFields: [
      { key: 'horizon', label: { vi: 'Kỳ dự báo', en: 'Horizon' }, value: '1–36 Months', tone: 'success' },
    ],
    keywords: ['ltv', 'cac', 'payback', 'cohort', 'retention', 'saas'],
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
