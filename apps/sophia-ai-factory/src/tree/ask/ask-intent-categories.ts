/**
 * Bilingual Natural Language Ask Router — Canonical Intent Categories & Command Allowlist
 *
 * Layer: tree/ask
 * @module tree/ask/ask-intent-categories
 */

import type { IntentCategoryDefinition } from './ask-types';

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
    keywordsVi: ['triển khai code', 'phát triển tính năng', 'tạo landing page', 'viết code', 'lập trình', 'xây dựng', 'tính năng', 'code'],
    keywordsEn: ['write code', 'landing page', 'implement', 'develop', 'scaffold', 'feature', 'build', 'code'],
  },
  {
    id: 'fix',
    targetCommand: '/fix',
    nameVi: 'Debug / Sửa lỗi',
    nameEn: 'Debug / Fix Issue',
    descriptionVi: 'Điều tra nguyên nhân gốc rễ, sửa lỗi bug và khắc phục sự cố hệ thống',
    descriptionEn: 'Root cause analysis, bug remediation, and defect resolution',
    keywordsVi: ['khắc phục sự cố', 'sửa lỗi', 'sửa bug', 'không chạy', 'hỏng', 'lỗi'],
    keywordsEn: ['remediate', 'broken', 'hotfix', 'debug', 'issue', 'error', 'bug', 'fix'],
  },
  {
    id: 'test',
    targetCommand: '/test',
    nameVi: 'Test / Kiểm thử',
    nameEn: 'Test / Automated Verification',
    descriptionVi: 'Viết và thực thi bài kiểm thử đơn vị, kiểm thử tích hợp và kiểm tra độ phủ',
    descriptionEn: 'Author and execute unit, integration, and regression test suites',
    keywordsVi: ['kiểm tra coverage', 'viết unit test', 'chạy test', 'viết test', 'kiểm thử'],
    keywordsEn: ['integration test', 'verify suite', 'unit test', 'write test', 'run test', 'coverage', 'test'],
  },
  {
    id: 'plan',
    targetCommand: '/plan',
    nameVi: 'Plan / Lập kế hoạch',
    nameEn: 'Plan / Strategy & Decomposition',
    descriptionVi: 'Lập kế hoạch kiến trúc, phân rã milestone và xác định lộ trình thực thi',
    descriptionEn: 'Architectural planning, milestone decomposition, and roadmap delivery',
    keywordsVi: ['lập kế hoạch', 'lên kế hoạch', 'tạo kế hoạch', 'tạo bài', 'lộ trình'],
    keywordsEn: ['create plan', 'build plan', 'decomposition', 'roadmap', 'strategy', 'plan'],
  },
  {
    id: 'brainstorm',
    targetCommand: '/brainstorm',
    nameVi: 'Brainstorm / Gợi ý ý tưởng',
    nameEn: 'Brainstorm / Ideation & Discovery',
    descriptionVi: 'Động não sáng kiến, gợi ý kịch bản tăng trưởng và phác thảo giải pháp',
    descriptionEn: 'Brainstorm innovative ideas, growth scenarios, and exploratory proposals',
    keywordsVi: ['gợi ý ý tưởng', 'ý tưởng', 'động não', 'sáng kiến', 'brainstorm'],
    keywordsEn: ['concept discovery', 'brain dump', 'suggestions', 'ideate', 'idea', 'brainstorm'],
  },
  {
    id: 'deploy',
    targetCommand: 'deploy',
    nameVi: 'Deploy / Triển khai',
    nameEn: 'Deploy / Release & Edge Shipping',
    descriptionVi: 'Đóng gói ứng dụng, xác thực preflight gate và phát hành lên Cloudflare Edge',
    descriptionEn: 'Bundle assets, verify deployment gates, and ship to Cloudflare Edge',
    keywordsVi: ['đưa lên production', 'deploy lên edge', 'triển khai', 'phát hành', 'push to edge'],
    keywordsEn: ['push to prod', 'publish edge', 'edge deploy', 'release', 'ship to', 'deploy', 'ship'],
  },
  {
    id: 'docs',
    targetCommand: '/docs',
    nameVi: 'Docs / Tài liệu',
    nameEn: 'Docs / Technical Documentation',
    descriptionVi: 'Tạo tài liệu kiến trúc, hướng dẫn vận hành và cập nhật sổ tay hướng dẫn',
    descriptionEn: 'Generate technical architecture docs, runbooks, and API guides',
    keywordsVi: ['viết tài liệu', 'tạo tài liệu', 'tài liệu api', 'hướng dẫn', 'sổ tay', 'tài liệu'],
    keywordsEn: ['documentation', 'document', 'readme', 'runbook', 'manual', 'guide', 'docs', 'doc'],
  },
  {
    id: 'analytics',
    targetCommand: 'analytics-report',
    nameVi: 'Analytics / Phân tích dữ liệu',
    nameEn: 'Analytics / Business & Performance Metrics',
    descriptionVi: 'Phân tích số liệu kinh doanh, chuyển đổi phễu và báo cáo tài chính doanh thu',
    descriptionEn: 'Analyze revenue metrics, conversion telemetry, and operational reports',
    keywordsVi: ['phân tích dữ liệu', 'báo cáo doanh thu', 'phân tích data', 'chỉ số kpi', 'doanh thu', 'số liệu'],
    keywordsEn: ['telemetry analysis', 'revenue report', 'data analysis', 'analyze data', 'analytics', 'metrics'],
  },
  {
    id: 'security',
    targetCommand: '/security-scan',
    nameVi: 'Security Scan / Quét bảo mật',
    nameEn: 'Security Scan / Vulnerability Assessment',
    descriptionVi: 'Quét lỗ hổng bảo mật, kiểm tra rò rỉ khóa bí mật và phòng chống tấn công',
    descriptionEn: 'Scan vulnerabilities, detect secret leaks, and harden attack surfaces',
    keywordsVi: ['quét bảo mật', 'kiểm tra bảo mật', 'an toàn thông tin', 'rà soát mã độc', 'lỗ hổng'],
    keywordsEn: ['vulnerability scan', 'penetration test', 'security review', 'security audit', 'security scan'],
  },
  {
    id: 'audit',
    targetCommand: '/audit-compliance',
    nameVi: 'Audit / Kiểm toán & Tuân thủ',
    nameEn: 'Audit / Governance & Compliance',
    descriptionVi: 'Kiểm toán quy trình, đối soát chính sách SOX/SOC2 và thẩm định tuân thủ',
    descriptionEn: 'Audit internal controls, verify SOC2 compliance, and inspect audit logs',
    keywordsVi: ['kiểm toán tuân thủ', 'kiểm tra compliance', 'kiểm toán', 'tuân thủ', 'đối soát'],
    keywordsEn: ['regulatory audit', 'internal audit', 'compliance', 'soc2', 'audit'],
  },
];

/**
 * List of recognized slash commands in the system allowlist.
 */
export const RECOGNIZED_COMMANDS: ReadonlySet<string> = new Set([
  '/ask', '/cook', '/fix', '/test', '/plan', '/brainstorm', 'deploy', '/deploy',
  '/docs', 'analytics-report', '/analytics-report', '/security-scan', '/audit-compliance',
  '/idea', '/binh-phap', '/ship', '/daily', '/cto', '/ke-toan', '/thue',
  '/sales', '/marketing', '/dev', '/ops', '/harness',
]);
