/**
 * 25-Step Open-Core + SaaS Restructuring Catalog — Part 1 (Steps 1–12)
 *
 * Covers Phase 1 (Foundation), Phase 2 (Business Model), and Phase 3 (Brand & GitHub).
 *
 * Layer: seed/config
 * @module seed/config/open-core-25-steps-data-p1
 */

import type { OpenCoreStepDefinition } from './open-core-25-steps-types';

export const OPEN_CORE_STEPS_PART_1: readonly OpenCoreStepDefinition[] = [
  {
    step: 1, phaseId: 'phase_1_foundation', slug: 'master-open-core-framework', editionScope: 'HYBRID',
    titleVi: 'Khung kiến trúc tổng thể Open-Core & SaaS', titleEn: 'Master Open-Core & SaaS Framework',
    businessRule: 'Apache-2.0 Community Core on GitHub drives PLG adoption; Cloud ($199-$799/mo) & Master ($4,999) monetize scale.',
    agenticRole: 'Founder leads; CTO, CMO, Sales/CS, and COO/CFO agents execute domain tasks.',
    governanceGate: 'Enforce 4-layer boundaries (seed->tree->forest->land), open-core-manifest.ts, and <= 180 LOC per file.',
    verificationArtifact: 'apps/sophia-ai-factory/src/seed/config/open-core-manifest.ts', linkedFeatureId: 'byok_setup_wizard',
  },
  {
    step: 2, phaseId: 'phase_1_foundation', slug: 'truthful-2026-plan-refresh', editionScope: 'HYBRID',
    titleVi: 'Đồng bộ hồ sơ công ty & dữ liệu sự thật', titleEn: '2026 Truthful Plan & Authority Refresh',
    businessRule: 'Reconcile all public and internal records with canonical pricing and verified $0 MRR baseline.',
    agenticRole: 'COO agent audits canonical source registers and flags discrepancies.',
    governanceGate: 'README.md, LICENSE, LICENSE-COMMERCIAL.md, and .mekong/company.json remain synchronized.',
    verificationArtifact: '.mekong/company.json',
  },
  {
    step: 3, phaseId: 'phase_1_foundation', slug: 'agentic-os-least-privilege', editionScope: 'COMMUNITY',
    titleVi: 'Hệ điều hành Agentic phân quyền tối thiểu', titleEn: 'Least-Privilege Agentic Operating System',
    businessRule: 'Solo founder leveraged by specialized AI agents under explicit human commercial approval.',
    agenticRole: 'CTO, CMO, Sales/CS, COO, and CFO agents operate within bounded scopes.',
    governanceGate: 'No agent modifies pricing, billing, credentials, or deploy gates without founder approval.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/ask', linkedFeatureId: 'bilingual_ask_router',
  },
  {
    step: 4, phaseId: 'phase_1_foundation', slug: 'ipo-merkle-audit-baseline', editionScope: 'ENTERPRISE_MASTER',
    titleVi: 'Sổ cái kiểm toán bất biến Merkle & tuân thủ', titleEn: 'Cryptographic Merkle Audit & Compliance Baseline',
    businessRule: 'Tamper-evident financial and operational audit trail for enterprise and institutional trust.',
    agenticRole: 'CFO/COO agents verify SHA-256 hash chain and HMAC signatures.',
    governanceGate: 'Comply with Vietnam PDPD 13/2023 and cybersecurity regulations.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/finance/merkle', linkedFeatureId: 'merkle_ipo_audit_vault',
  },
  {
    step: 5, phaseId: 'phase_1_foundation', slug: 'gap-report-and-pilot-roadmap', editionScope: 'CLOUD_SAAS',
    titleVi: 'Báo cáo khoảng cách & lộ trình khách hàng trả phí đầu tiên', titleEn: 'Gap Report & First Paid Pilot Roadmap',
    businessRule: 'Prioritize closing first paid pilot via NOWPayments/PayOS and GitHub community traction.',
    agenticRole: 'Agents track 6-step pilot readiness and objection matrix.',
    governanceGate: 'Escalate payment, secret hygiene, or license isolation issues immediately.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/open-core/pilot-onboarding-tracker.ts',
  },
  {
    step: 6, phaseId: 'phase_2_business_model', slug: 'open-core-unit-economics', editionScope: 'CLOUD_SAAS',
    titleVi: 'Mô hình kinh tế đơn vị Open-Core & BYOK', titleEn: 'Open-Core & BYOK Unit Economics Engine',
    businessRule: 'Customer BYOK shifts third-party AI compute costs to users, preserving 85-95% subscription margin.',
    agenticRole: 'CFO agent reconciles collected revenue, gateway fees, edge hosting, and founder support time.',
    governanceGate: 'NOWPayments (USDT) and PayOS only; Polar.sh and PayPal are strictly banned.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/finance/pilot-unit-economics.ts', linkedFeatureId: 'multi_tenant_saas_billing',
  },
  {
    step: 7, phaseId: 'phase_2_business_model', slug: 'customer-and-developer-personas', editionScope: 'HYBRID',
    titleVi: 'Chân dung khách hàng Agency & lập trình viên mã nguồn mở', titleEn: 'Commercial ICP & Open-Source Developer Personas',
    businessRule: 'Primary ICP: VN marketing agencies/SMBs ($199-$799/mo). Secondary PLG wedge: GitHub self-hosters.',
    agenticRole: 'Sales agent evaluates discovery interviews and synthesizes objection frequency.',
    governanceGate: 'Require explicit consent before recording interviews or publishing customer quotes.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/open-core/discovery-interview-evaluator.ts',
  },
  {
    step: 8, phaseId: 'phase_3_brand_github_community', slug: 'transparent-open-core-positioning', editionScope: 'COMMUNITY',
    titleVi: 'Định vị thương hiệu Open-Core minh bạch', titleEn: 'Transparent Open-Core Brand Positioning',
    businessRule: 'Inspectable security and code on Public GitHub (Apache-2.0) paired with zero-tech Cloud execution.',
    agenticRole: 'CMO agent maintains bilingual VI/EN messaging across repo and web portal.',
    governanceGate: 'Prohibit unverified ROI claims; highlight verifiable AES-256-GCM BYOK architecture.',
    verificationArtifact: 'README.md', linkedFeatureId: 'single_channel_video_studio',
  },
  {
    step: 9, phaseId: 'phase_3_brand_github_community', slug: 'content-pillars-and-self-hosting-docs', editionScope: 'COMMUNITY',
    titleVi: 'Trụ cột nội dung & tài liệu tự triển khai (Self-Hosting)', titleEn: 'Content Pillars & GitHub Self-Hosting Documentation',
    businessRule: '4 pillars: codebase walkthroughs, AI video prompts, agency playbooks, and social pacing guides.',
    agenticRole: 'CMO and docs agents verify every CLI command against package.json scripts.',
    governanceGate: 'Never publish plausible documentation; verify all commands against live source.',
    verificationArtifact: 'docs/SELF_HOSTING.md',
  },
  {
    step: 10, phaseId: 'phase_3_brand_github_community', slug: 'dual-entrypoint-upgrade-narrative', editionScope: 'HYBRID',
    titleVi: 'Hành trình kép GitHub README sang Sophia Cloud', titleEn: 'Dual Entrypoint & Commercial Upgrade Narrative',
    businessRule: 'Connect GitHub self-hosters to Sophia Cloud via CommercialUpgradeModal and /pricing.',
    agenticRole: 'UX and CMO agents maintain clear Community vs Cloud vs Enterprise feature matrices.',
    governanceGate: 'Maintain unambiguous legal distinction between Apache-2.0 and Commercial FSL-1.1 terms.',
    verificationArtifact: 'apps/sophia-ai-factory/src/components/open-core/commercial-upgrade-modal.tsx',
  },
  {
    step: 11, phaseId: 'phase_3_brand_github_community', slug: 'creative-testing-bandit-allocation', editionScope: 'CLOUD_SAAS',
    titleVi: 'Thử nghiệm sáng tạo định lượng (Thompson Sampling & Half-Kelly)', titleEn: 'Quantitative Creative Testing (MAB & Half-Kelly)',
    businessRule: 'Automate A/B hook testing and capital allocation on Managed Cloud after organic baseline.',
    agenticRole: 'Growth agent executes Thompson Sampling MAB and Fractional Half-Kelly sizing.',
    governanceGate: 'Enforce strict budget caps and synthetic media disclosure policies.',
    verificationArtifact: 'apps/sophia-ai-factory/src/land/growth-v14', linkedFeatureId: 'growth_triad_bandit_kelly',
  },
  {
    step: 12, phaseId: 'phase_3_brand_github_community', slug: 'verified-case-study-governance', editionScope: 'CLOUD_SAAS',
    titleVi: 'Quy chuẩn Case Study dựa trên bằng chứng thực tế', titleEn: 'Evidence-Backed Case Study & Advertorial Rules',
    businessRule: 'Document agency workflow transformations using only consented, verifiable pilot metrics.',
    agenticRole: 'Content agent structures problem-solution-outcome reports from D1 pilot ledgers.',
    governanceGate: 'Zero synthetic or unvalidated customer testimonials permitted.',
    verificationArtifact: 'docs/open-core-community-launch-kit.md',
  },
] as const;
