/**
 * Bilingual Natural Language Ask Router & 4-Advisor Architecture Consultation
 *
 * Implements the Sophia AI Factory /ask NL routing specification:
 * - Bilingual Vietnamese-first & English keyword intent classification
 * - 10 canonical intent categories
 * - fnmatch wildcard semantics (*prefix, suffix*, *contains*, exact)
 * - Specificity-ranked keyword matching (longer phrases take precedence)
 * - Unknown-command validation and rejection
 * - Backward-compatible fallback to 4-Advisor Architecture Consultation
 *
 * Layer: tree/ask
 * Constraint: Zero :any, zero console.log/warn/error, strict one-way imports.
 *
 * @module tree/ask/ask-router
 */

import { logger } from '@/seed/utils/logger-utility';

export type CanonicalIntentId =
  | 'cook'
  | 'fix'
  | 'test'
  | 'plan'
  | 'brainstorm'
  | 'deploy'
  | 'docs'
  | 'analytics'
  | 'security'
  | 'audit';

export type CanonicalTargetCommand =
  | '/cook'
  | '/fix'
  | '/test'
  | '/plan'
  | '/brainstorm'
  | 'deploy'
  | '/docs'
  | 'analytics-report'
  | '/security-scan'
  | '/audit-compliance';

export type RouteMode =
  | 'command-routed'
  | 'architecture-consultation'
  | 'unknown-command-rejected';

export interface IntentCategoryDefinition {
  readonly id: CanonicalIntentId;
  readonly targetCommand: CanonicalTargetCommand;
  readonly nameVi: string;
  readonly nameEn: string;
  readonly descriptionVi: string;
  readonly descriptionEn: string;
  readonly keywordsVi: readonly string[];
  readonly keywordsEn: readonly string[];
}

export interface FourAdvisorConsultation {
  readonly systemsDesigner: { readonly vi: string; readonly en: string };
  readonly technologyStrategist: { readonly vi: string; readonly en: string };
  readonly scalabilityConsultant: { readonly vi: string; readonly en: string };
  readonly riskAnalyst: { readonly vi: string; readonly en: string };
  readonly synthesis: { readonly vi: string; readonly en: string };
}

export interface AskRouteResult {
  readonly query: string;
  readonly mode: RouteMode;
  readonly matchedIntent?: IntentCategoryDefinition;
  readonly matchedKeyword?: string;
  readonly matchedLanguage?: 'vi' | 'en';
  readonly targetCommand?: CanonicalTargetCommand;
  readonly consultation?: FourAdvisorConsultation;
  readonly rejectionReason?: { readonly vi: string; readonly en: string };
  readonly outputMessageVi: string;
  readonly outputMessageEn: string;
}

/**
 * 10 Canonical Intent Categories with Vietnamese-first and English keyword sets.
 */
export const CANONICAL_INTENT_CATEGORIES: readonly IntentCategoryDefinition[] = [
  {
    id: 'cook',
    targetCommand: '/cook',
    nameVi: 'Build / Code / Lập trình',
    nameEn: 'Build / Code / Implementation',
    descriptionVi: 'Xây dựng tính năng, viết mã nguồn và triển khai module logic mới',
    descriptionEn: 'Build features, implement source code, and scaffold logical modules',
    keywordsVi: [
      'triển khai code',
      'phát triển tính năng',
      'tạo landing page',
      'viết code',
      'lập trình',
      'xây dựng',
      'tính năng',
      'code',
    ],
    keywordsEn: [
      'write code',
      'landing page',
      'implement',
      'develop',
      'scaffold',
      'feature',
      'build',
      'code',
    ],
  },
  {
    id: 'fix',
    targetCommand: '/fix',
    nameVi: 'Debug / Sửa lỗi',
    nameEn: 'Debug / Fix Issue',
    descriptionVi: 'Điều tra nguyên nhân gốc rễ, sửa lỗi bug và khắc phục sự cố hệ thống',
    descriptionEn: 'Root cause analysis, bug remediation, and defect resolution',
    keywordsVi: [
      'khắc phục sự cố',
      'sửa lỗi',
      'sửa bug',
      'không chạy',
      'hỏng',
      'lỗi',
    ],
    keywordsEn: [
      'remediate',
      'broken',
      'hotfix',
      'debug',
      'issue',
      'error',
      'bug',
      'fix',
    ],
  },
  {
    id: 'test',
    targetCommand: '/test',
    nameVi: 'Test / Kiểm thử',
    nameEn: 'Test / Automated Verification',
    descriptionVi: 'Viết và thực thi bài kiểm thử đơn vị, kiểm thử tích hợp và kiểm tra độ phủ',
    descriptionEn: 'Author and execute unit, integration, and regression test suites',
    keywordsVi: [
      'kiểm tra coverage',
      'viết unit test',
      'chạy test',
      'viết test',
      'kiểm thử',
    ],
    keywordsEn: [
      'integration test',
      'verify suite',
      'unit test',
      'write test',
      'run test',
      'coverage',
      'test',
    ],
  },
  {
    id: 'plan',
    targetCommand: '/plan',
    nameVi: 'Plan / Lập kế hoạch',
    nameEn: 'Plan / Strategy & Decomposition',
    descriptionVi: 'Lập kế hoạch kiến trúc, phân rã milestone và xác định lộ trình thực thi',
    descriptionEn: 'Architectural planning, milestone decomposition, and roadmap delivery',
    keywordsVi: [
      'lập kế hoạch',
      'lên kế hoạch',
      'tạo kế hoạch',
      'tạo bài',
      'lộ trình',
    ],
    keywordsEn: [
      'create plan',
      'build plan',
      'decomposition',
      'roadmap',
      'strategy',
      'plan',
    ],
  },
  {
    id: 'brainstorm',
    targetCommand: '/brainstorm',
    nameVi: 'Brainstorm / Gợi ý ý tưởng',
    nameEn: 'Brainstorm / Ideation & Discovery',
    descriptionVi: 'Động não sáng kiến, gợi ý kịch bản tăng trưởng và phác thảo giải pháp',
    descriptionEn: 'Brainstorm innovative ideas, growth scenarios, and exploratory proposals',
    keywordsVi: [
      'gợi ý ý tưởng',
      'ý tưởng',
      'động não',
      'sáng kiến',
      'brainstorm',
    ],
    keywordsEn: [
      'concept discovery',
      'brain dump',
      'suggestions',
      'ideate',
      'idea',
      'brainstorm',
    ],
  },
  {
    id: 'deploy',
    targetCommand: 'deploy',
    nameVi: 'Deploy / Triển khai',
    nameEn: 'Deploy / Release & Edge Shipping',
    descriptionVi: 'Đóng gói ứng dụng, xác thực preflight gate và phát hành lên Cloudflare Edge',
    descriptionEn: 'Bundle assets, verify deployment gates, and ship to Cloudflare Edge',
    keywordsVi: [
      'đưa lên production',
      'deploy lên edge',
      'triển khai',
      'phát hành',
      'push to edge',
    ],
    keywordsEn: [
      'push to prod',
      'publish edge',
      'edge deploy',
      'release',
      'ship to',
      'deploy',
      'ship',
    ],
  },
  {
    id: 'docs',
    targetCommand: '/docs',
    nameVi: 'Docs / Tài liệu',
    nameEn: 'Docs / Technical Documentation',
    descriptionVi: 'Tạo tài liệu kiến trúc, hướng dẫn vận hành và cập nhật sổ tay hướng dẫn',
    descriptionEn: 'Generate technical architecture docs, runbooks, and API guides',
    keywordsVi: [
      'viết tài liệu',
      'tạo tài liệu',
      'tài liệu api',
      'hướng dẫn',
      'sổ tay',
      'tài liệu',
    ],
    keywordsEn: [
      'documentation',
      'document',
      'readme',
      'runbook',
      'manual',
      'guide',
      'docs',
      'doc',
    ],
  },
  {
    id: 'analytics',
    targetCommand: 'analytics-report',
    nameVi: 'Analytics / Phân tích dữ liệu',
    nameEn: 'Analytics / Business & Performance Metrics',
    descriptionVi: 'Phân tích số liệu kinh doanh, chuyển đổi phễu và báo cáo tài chính doanh thu',
    descriptionEn: 'Analyze revenue metrics, conversion telemetry, and operational reports',
    keywordsVi: [
      'phân tích dữ liệu',
      'báo cáo doanh thu',
      'phân tích data',
      'chỉ số kpi',
      'doanh thu',
      'số liệu',
    ],
    keywordsEn: [
      'telemetry analysis',
      'revenue report',
      'data analysis',
      'analyze data',
      'analytics',
      'metrics',
    ],
  },
  {
    id: 'security',
    targetCommand: '/security-scan',
    nameVi: 'Security Scan / Quét bảo mật',
    nameEn: 'Security Scan / Vulnerability Assessment',
    descriptionVi: 'Quét lỗ hổng bảo mật, kiểm tra rò rỉ khóa bí mật và phòng chống tấn công',
    descriptionEn: 'Scan vulnerabilities, detect secret leaks, and harden attack surfaces',
    keywordsVi: [
      'quét bảo mật',
      'kiểm tra bảo mật',
      'an toàn thông tin',
      'rà soát mã độc',
      'lỗ hổng',
    ],
    keywordsEn: [
      'vulnerability scan',
      'penetration test',
      'security review',
      'security audit',
      'security scan',
    ],
  },
  {
    id: 'audit',
    targetCommand: '/audit-compliance',
    nameVi: 'Audit / Kiểm toán & Tuân thủ',
    nameEn: 'Audit / Governance & Compliance',
    descriptionVi: 'Kiểm toán quy trình, đối soát chính sách SOX/SOC2 và thẩm định tuân thủ',
    descriptionEn: 'Audit internal controls, verify SOC2 compliance, and inspect audit logs',
    keywordsVi: [
      'kiểm toán tuân thủ',
      'kiểm tra compliance',
      'kiểm toán',
      'tuân thủ',
      'đối soát',
    ],
    keywordsEn: [
      'regulatory audit',
      'internal audit',
      'compliance',
      'soc2',
      'audit',
    ],
  },
];

/**
 * List of recognized slash commands in the system allowlist.
 */
export const RECOGNIZED_COMMANDS: ReadonlySet<string> = new Set([
  '/ask',
  '/cook',
  '/fix',
  '/test',
  '/plan',
  '/brainstorm',
  'deploy',
  '/deploy',
  '/docs',
  'analytics-report',
  '/analytics-report',
  '/security-scan',
  '/audit-compliance',
  '/idea',
  '/binh-phap',
  '/ship',
  '/daily',
  '/cto',
  '/ke-toan',
  '/thue',
  '/sales',
  '/marketing',
  '/dev',
  '/ops',
  '/harness',
]);

/**
 * Checks if a candidate text matches a pattern using fnmatch wildcard semantics.
 */
export function matchesWildcard(pattern: string, text: string): boolean {
  const normPattern = pattern.trim().toLowerCase();
  const normText = text.trim().toLowerCase();

  if (normPattern.length === 0 || normText.length === 0) {
    return false;
  }

  // Double-ended wildcard: *word* -> contains
  if (normPattern.startsWith('*') && normPattern.endsWith('*')) {
    const sub = normPattern.slice(1, -1);
    return sub.length > 0 && normText.includes(sub);
  }

  // Prefix wildcard: *word -> string ends with word
  if (normPattern.startsWith('*')) {
    const sub = normPattern.slice(1);
    return sub.length > 0 && normText.endsWith(sub);
  }

  // Suffix wildcard: word* -> string starts with word
  if (normPattern.endsWith('*')) {
    const sub = normPattern.slice(0, -1);
    return sub.length > 0 && normText.startsWith(sub);
  }

  // Plain keyword without wildcard: contains verbatim
  return normText.includes(normPattern);
}

/**
 * Synthesizes a structured 4-Advisor architectural consultation report.
 */
export function generateArchitecturalConsultation(query: string): FourAdvisorConsultation {
  return {
    systemsDesigner: {
      vi: `[Hệ thống & Phân tầng] Yêu cầu "${query}" được thẩm định qua ranh giới 4 tầng Mekong: seed (cốt lõi, types, D1/R2 abstractions), tree (nghiệp vụ thuần túy, services, IoC), forest (state, server actions, inngest pipelines), và land (webhooks, edge API routes, UI). Giữ vững nguyên tắc phụ thuộc một chiều, tuyệt đối không cho phép circular dependency hoặc upward imports.`,
      en: `[Systems Architecture & Boundaries] The request "${query}" is scoped across Mekong 4-Layer boundaries: seed (domain core, D1/R2 abstractions), tree (pure domain logic, services, IoC), forest (state, server actions, inngest orchestration), and land (webhooks, edge API routes, and presentation). Strict one-way dependency rules apply with zero upward or circular imports.`,
    },
    technologyStrategist: {
      vi: `[Chiến lược Công nghệ] Đồng vị trí (co-locate) giữa Next.js 16 trên Cloudflare Workers Edge với Cloudflare D1 (SQLite) và R2 storage nhằm đảm bảo zero-cold start (<15ms). Áp dụng Queue-First pattern cho các tác vụ tính toán nặng và IoC adapter cho dịch vụ bên thứ ba (NOWPayments, PayOS, Resend).`,
      en: `[Technology Strategy] Co-locate Next.js 16 on Cloudflare Workers edge runtime with Cloudflare D1 (SQLite) and R2 storage for near-zero cold starts (<15ms). Enforce queue-first patterns for asynchronous AI pipelines and canonical IoC adapters for third-party providers (NOWPayments, PayOS, Resend).`,
    },
    scalabilityConsultant: {
      vi: `[Hiệu năng & Khả năng Mở rộng] Để xử lý tải đồng thời cao, thực thi thao tác cập nhật quota nguyên tử (Atomic Quota CAS) trực tiếp trên D1. Sử dụng Optimistic Concurrency Control (OCC) với version locking cho sổ cái thanh toán và đặt Cloudflare KV làm tầng đệm đọc (60s TTL) để triệt tiêu hiện tượng write lock contention trên SQLite.`,
      en: `[Scalability & Throughput] Under high concurrent load, enforce atomic quota counter CAS directly in D1. Employ Optimistic Concurrency Control (OCC) with version locking on financial transaction ledgers, backed by Cloudflare KV read-path caching (60s TTL) to prevent SQLite write lock contention.`,
    },
    riskAnalyst: {
      vi: `[An toàn Thông tin & Giảm thiểu Rủi ro] Bắt buộc kiểm tra chữ ký webhook trong thời gian hằng số (timingSafeEqual) kèm cửa sổ chống phát lại (replay window <= 300s). Khóa BYOK phải được mã hóa phong bì AES-GCM-256 có quản lý phiên bản (active key versioning) cho phép xoay vòng khóa không downtime. Tuân thủ triệt để nguyên lý Fail-Closed.`,
      en: `[Security & Risk Mitigation] Webhook verifications must enforce constant-time signature comparison (timingSafeEqual) and strict timestamp replay protection (window <= 300s). BYOK credentials require versioned AES-GCM-256 envelope encryption supporting zero-downtime key rotation. Always fail-closed on verification boundaries.`,
    },
    synthesis: {
      vi: `[Tổng kết 4 Cố Vấn] Giải pháp tối ưu tuân thủ bộ ba YAGNI, KISS, DRY: Không thêm thành phần phụ thuộc ngoài khi D1/KV đáp ứng được; giữ code cô lập theo 4 tầng; và viết kiểm thử tự động 100% trước khi bàn giao.`,
      en: `[4-Advisor Synthesis] Recommended solution adheres strictly to YAGNI, KISS, and DRY: avoid external dependencies where edge primitives suffice; preserve clean 4-layer isolation; and back all interfaces with comprehensive automated verification suites.`,
    },
  };
}

interface MatchCandidate {
  readonly intent: IntentCategoryDefinition;
  readonly keyword: string;
  readonly language: 'vi' | 'en';
  readonly specificity: number;
}

function checkUnknownCommand(trimmed: string): AskRouteResult | null {
  if (!trimmed.startsWith('/')) {
    return null;
  }
  const commandToken = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (commandToken.length <= 1 || RECOGNIZED_COMMANDS.has(commandToken)) {
    return null;
  }

  logger.info(`[AskRouter] Rejected unknown command: ${commandToken}`);
  return {
    query: trimmed,
    mode: 'unknown-command-rejected',
    rejectionReason: {
      vi: `Lệnh "${commandToken}" không tồn tại hoặc không được hỗ trợ trong danh mục lệnh cho phép.`,
      en: `Command "${commandToken}" does not exist or is not permitted in the system allowlist.`,
    },
    outputMessageVi: `❌ [Từ chối lệnh] Lệnh "${commandToken}" không được công nhận. Vui lòng sử dụng các lệnh chuẩn như /cook, /fix, /test, /plan, /brainstorm, /docs, /security-scan, /audit-compliance hoặc nhập câu hỏi tự nhiên.`,
    outputMessageEn: `❌ [Command Rejected] Command "${commandToken}" is unrecognized. Please use supported commands (/cook, /fix, /test, /plan, /brainstorm, /docs, /security-scan, /audit-compliance) or enter a natural language prompt.`,
  };
}

function findBestIntentMatch(trimmed: string, language: 'vi' | 'en'): MatchCandidate | null {
  const matches: MatchCandidate[] = [];
  for (const intent of CANONICAL_INTENT_CATEGORIES) {
    const keywords = language === 'vi' ? intent.keywordsVi : intent.keywordsEn;
    for (const kw of keywords) {
      if (matchesWildcard(kw, trimmed)) {
        matches.push({
          intent,
          keyword: kw,
          language,
          specificity: kw.length,
        });
      }
    }
  }
  if (matches.length === 0) {
    return null;
  }
  matches.sort((a, b) => b.specificity - a.specificity);
  return matches[0] ?? null;
}

function buildRoutedResult(trimmed: string, match: MatchCandidate): AskRouteResult {
  const langLabel = match.language.toUpperCase();
  logger.info(`[AskRouter] Matched ${langLabel} intent "${match.intent.id}" with keyword "${match.keyword}"`);
  return {
    query: trimmed,
    mode: 'command-routed',
    matchedIntent: match.intent,
    matchedKeyword: match.keyword,
    matchedLanguage: match.language,
    targetCommand: match.intent.targetCommand,
    outputMessageVi: `➡️ [Định tuyến thành công] Yêu cầu của bạn khớp với mục đích "${match.intent.nameVi}". Đang chuyển hướng sang lệnh: ${match.intent.targetCommand}`,
    outputMessageEn: `➡️ [Routed Successfully] Your request matched intent "${match.intent.nameEn}". Redirecting to target command: ${match.intent.targetCommand}`,
  };
}

/**
 * Natural Language /ask Router.
 *
 * Evaluates the user query against the 10 canonical intent categories:
 * 1. Rejects invalid unknown slash commands.
 * 2. Scans for Vietnamese keyword matches (prioritizing longer, more specific phrases).
 * 3. Scans for English keyword matches (prioritizing longer, more specific phrases).
 * 4. Falls back to 4-Advisor architectural consultation mode.
 *
 * @param query The raw user natural language string or command query.
 * @returns Comprehensive AskRouteResult with bilingual routing outcomes.
 */
export function routeAsk(query: string): AskRouteResult {
  const trimmed = (query ?? '').trim();

  // 1. Check for explicit unknown slash command invocation
  const rejected = checkUnknownCommand(trimmed);
  if (rejected) {
    return rejected;
  }

  // 2. Vietnamese-first keyword matching
  const bestVi = findBestIntentMatch(trimmed, 'vi');
  if (bestVi) {
    return buildRoutedResult(trimmed, bestVi);
  }

  // 3. English keyword matching
  const bestEn = findBestIntentMatch(trimmed, 'en');
  if (bestEn) {
    return buildRoutedResult(trimmed, bestEn);
  }

  // 4. Backward-Compatible Fallback: 4-Advisor Architecture Consultation
  logger.info(`[AskRouter] No keyword match; falling back to 4-Advisor architectural consultation for query: "${trimmed}"`);
  const consultation = generateArchitecturalConsultation(trimmed);

  const outputMessageVi = [
    `🏛️ [Hội Đồng 4 Cố Vấn Kiến Trúc — Phân Tích & Tư Vấn Chuyên Sâu]`,
    `Câu hỏi: "${trimmed}"`,
    ``,
    `1. Systems Designer (Thiết kế Hệ thống & Phân tầng):`,
    `   ${consultation.systemsDesigner.vi}`,
    ``,
    `2. Technology Strategist (Chiến lược Công nghệ & Edge Synergy):`,
    `   ${consultation.technologyStrategist.vi}`,
    ``,
    `3. Scalability Consultant (Khả năng Mở rộng & Concurrency):`,
    `   ${consultation.scalabilityConsultant.vi}`,
    ``,
    `4. Risk Analyst (Phân tích Rủi ro & An toàn Thông tin):`,
    `   ${consultation.riskAnalyst.vi}`,
    ``,
    `⭐ Kết luận Tổng hợp:`,
    `   ${consultation.synthesis.vi}`,
  ].join('\n');

  const outputMessageEn = [
    `🏛️ [4-Advisor Architectural Consultation & Strategic Guidance]`,
    `Query: "${trimmed}"`,
    ``,
    `1. Systems Designer (Architecture Boundaries & Layering):`,
    `   ${consultation.systemsDesigner.en}`,
    ``,
    `2. Technology Strategist (Technology Stack & Edge Synergy):`,
    `   ${consultation.technologyStrategist.en}`,
    ``,
    `3. Scalability Consultant (Throughput & Concurrency):`,
    `   ${consultation.scalabilityConsultant.en}`,
    ``,
    `4. Risk Analyst (Security & Risk Mitigation):`,
    `   ${consultation.riskAnalyst.en}`,
    ``,
    `⭐ Strategic Synthesis:`,
    `   ${consultation.synthesis.en}`,
  ].join('\n');

  return {
    query: trimmed,
    mode: 'architecture-consultation',
    consultation,
    outputMessageVi,
    outputMessageEn,
  };
}
