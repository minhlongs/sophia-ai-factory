/**
 * 25-Step Open-Core + SaaS Restructuring Catalog — Part 2 (Steps 13–25)
 *
 * Covers Phase 4 (Revenue & Conversion), Phase 5 (Operations & Security), and Phase 6 (Governance).
 *
 * Layer: seed/config
 * @module seed/config/open-core-25-steps-data-p2
 */

import type { OpenCoreStepDefinition } from './open-core-25-steps-types';

export const OPEN_CORE_STEPS_PART_2: readonly OpenCoreStepDefinition[] = [
  {
    step: 13, phaseId: 'phase_4_revenue_conversion_engine', slug: 'bilingual-lifecycle-upgrade-sequences', editionScope: 'CLOUD_SAAS',
    titleVi: 'Chuỗi email vòng đời & gợi ý nâng cấp Cloud song ngữ', titleEn: 'Bilingual Lifecycle & Cloud Upgrade Sequences',
    businessRule: 'Automated bilingual triggers for BYOK completion, first video milestone, and Cloud upgrades.',
    agenticRole: 'Lifecycle agent manages Resend templates and opt-in notification state.',
    governanceGate: 'Strictly opt-in; never include raw API keys or sensitive tokens in emails.',
    verificationArtifact: 'apps/sophia-ai-factory/src/seed/config/edition-messages.ts',
  },
  {
    step: 14, phaseId: 'phase_4_revenue_conversion_engine', slug: 'plg-portability-and-protected-flows', editionScope: 'HYBRID',
    titleVi: 'Phễu chuyển đổi Workspace Portability & 3 Luồng Bảo Vệ', titleEn: 'PLG Workspace Portability Funnel & Protected Flows',
    businessRule: 'Self-hosters export signed HMAC bundle (/api/open-core/portability) and import to Cloud in < 60s.',
    agenticRole: 'Sales/CS and CTO agents guard Setup Wizard, @Sophia_Bbot, and NOWPayments IPN.',
    governanceGate: 'Raw BYOK keys never leave the AES-256-GCM vault during workspace export/import.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/open-core/workspace-portability.ts', linkedFeatureId: 'telegram_bot_commands',
  },
  {
    step: 15, phaseId: 'phase_4_revenue_conversion_engine', slug: 'bullseye-gtm-and-affiliate-engine', editionScope: 'CLOUD_SAAS',
    titleVi: 'Thử nghiệm kênh GTM Bullseye & Đối soát Affiliate', titleEn: 'Bullseye GTM Channels & Affiliate Attribution Engine',
    businessRule: '3 traction channels: direct VN agency outreach, GitHub Open-Core launches, and affiliate partners.',
    agenticRole: 'Growth agent tracks postback conversions and automated USDT/VND partner payouts.',
    governanceGate: 'Halt acquisition channels that fail to produce qualified pilot interest.',
    verificationArtifact: 'apps/sophia-ai-factory/src/land/affiliates', linkedFeatureId: 'affiliate_attribution_payouts',
  },
  {
    step: 16, phaseId: 'phase_5_operations_security_readiness', slug: 'aarrr-and-version-beacon-analytics', editionScope: 'HYBRID',
    titleVi: 'Phân tích phễu AARRR & Tín hiệu phiên bản (Version Beacon)', titleEn: 'AARRR Funnel & Privacy-Safe Version Beacon',
    businessRule: 'Track GitHub stars, opt-in version beacon pings, BYOK completions, and weekly active videos.',
    agenticRole: 'Analytics agent aggregates privacy-safe telemetry from Cloudflare Workers and D1.',
    governanceGate: 'Respect SOPHIA_DISABLE_VERSION_BEACON=true opt-out and exclude internal test accounts.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/open-core/version-beacon.ts',
  },
  {
    step: 17, phaseId: 'phase_5_operations_security_readiness', slug: 'vc-narrative-and-white-label-scale', editionScope: 'ENTERPRISE_MASTER',
    titleVi: 'Câu chuyện gọi vốn & Cổng Agency White-Label đa khách hàng', titleEn: 'Strategic Narrative & White-Label Agency Subaccount Scale',
    businessRule: 'Combine Open-Core developer trust with high-margin BYOK SaaS and agency subaccount expansion.',
    agenticRole: 'Founder leads investor discussions; CTO/CFO agents maintain factual architecture exhibits.',
    governanceGate: 'Disclose stage honestly as Zero->PSF with $0 MRR baseline until paid pilots close.',
    verificationArtifact: 'apps/sophia-ai-factory/src/forest/admin/white-label', linkedFeatureId: 'white_label_agency_portal',
  },
  {
    step: 18, phaseId: 'phase_5_operations_security_readiness', slug: 'dual-license-ip-and-secret-hygiene', editionScope: 'ENTERPRISE_MASTER',
    titleVi: 'Bảo vệ sở hữu trí tuệ Dual-License & Quét bí mật CI', titleEn: 'Dual-License IP Boundary & CI Secret Hygiene',
    businessRule: 'Server-side HMAC-SHA256 RaaS license verification (SOPHIA-RAAS-v1) and zero-leak secretlint gate.',
    agenticRole: 'Security and CTO agents enforce secretlint, layer boundaries, and org-bound license checks.',
    governanceGate: 'COMMUNITY modules must never import commercial ENTERPRISE_MASTER modules.',
    verificationArtifact: 'apps/sophia-ai-factory/src/seed/security/raas-license-verifier.ts',
  },
  {
    step: 19, phaseId: 'phase_5_operations_security_readiness', slug: 'solo-founder-agentic-org-design', editionScope: 'COMMUNITY',
    titleVi: 'Thiết kế tổ chức Solo-Founder kết hợp Đội ngũ AI Agent', titleEn: 'Solo-Founder + Specialized AI Agent Org Design',
    businessRule: 'Keep burn near zero by delegating drafting, testing, and ops monitoring to AI agents.',
    agenticRole: 'Agents produce structured completion reports; founder owns legal, banking, and hiring.',
    governanceGate: 'Maintain Contributing and Code of Conduct standards for external GitHub contributors.',
    verificationArtifact: 'CONTRIBUTING.md',
  },
  {
    step: 20, phaseId: 'phase_5_operations_security_readiness', slug: 'open-core-benchmarks-custom-domains', editionScope: 'ENTERPRISE_MASTER',
    titleVi: 'Chuẩn đối sánh Open-Core & Tên miền riêng (Custom Domains)', titleEn: 'Open-Core Benchmarks & Custom Domain SSL Provisioning',
    businessRule: 'Follow proven Open-Core patterns (Supabase, PostHog, Cal.com): free core, paid custom domains/scale.',
    agenticRole: 'Research and infra agents manage automated DNS TXT/CNAME verification.',
    governanceGate: 'Preserve full Apache-2.0 freedom on Community Core without artificial timebombs.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/custom-domains', linkedFeatureId: 'custom_domain_provisioning',
  },
  {
    step: 21, phaseId: 'phase_5_operations_security_readiness', slug: 'evidence-backed-data-room-handover', editionScope: 'ENTERPRISE_MASTER',
    titleVi: 'Phòng dữ liệu kiểm chứng & Bộ bàn giao Master $4,999', titleEn: 'Evidence-Backed Data Room & Day-1 Master Handover ($4,999)',
    businessRule: 'Turnkey 10-checkpoint sovereign infrastructure verification for $4,999 Master buyers.',
    agenticRole: 'CFO and CTO agents maintain live verification scripts and dual-license documentation.',
    governanceGate: 'Every data-room claim must link to a verifiable repository file or D1 ledger record.',
    verificationArtifact: 'apps/sophia-ai-factory/src/tree/handover', linkedFeatureId: 'day1_master_handover_suite',
  },
  {
    step: 22, phaseId: 'phase_6_execution_governance', slug: 'quarterly-okrs-and-execution-cadence', editionScope: 'HYBRID',
    titleVi: 'Thực thi OKR hàng quý (Pilot trả phí, GitHub Stars, Portability)', titleEn: 'Quarterly OKR Execution (Paid Pilots, Stars, Portability)',
    businessRule: 'Target 3 paid agency pilots, 500+ GitHub stars, and 5 Community->Cloud migrations in 6 months.',
    agenticRole: 'Department agents track weekly progress against plans/company-blueprint/tasks.md.',
    governanceGate: 'Reallocate engineering effort if an experiment fails to generate customer evidence.',
    verificationArtifact: 'plans/company-blueprint/tasks.md',
  },
  {
    step: 23, phaseId: 'phase_6_execution_governance', slug: 'founder-operating-review-governance', editionScope: 'HYBRID',
    titleVi: 'Quản trị rà soát vận hành hàng tháng của Founder', titleEn: 'Monthly Founder Operating Review & Governance',
    businessRule: 'Monthly review of cash collected, cloud unit costs, pilot retention, and open-source PRs.',
    agenticRole: 'COO agent compiles factual monthly operating packs.',
    governanceGate: 'Record all licensing, pricing, and architectural decisions in version control.',
    verificationArtifact: 'plans/company-blueprint/plan.md',
  },
  {
    step: 24, phaseId: 'phase_6_execution_governance', slug: 'responsible-ai-byok-privacy-esg', editionScope: 'COMMUNITY',
    titleVi: 'AI có trách nhiệm, bảo mật BYOK AES-256-GCM & tuân thủ PDPD', titleEn: 'Responsible AI, BYOK Envelope Privacy & PDPD Compliance',
    businessRule: 'Customer API keys are envelope-encrypted via AES-256-GCM; community code of conduct enforced.',
    agenticRole: 'CTO and compliance agents audit encryption boundaries and synthetic media disclosures.',
    governanceGate: 'Enforce CODE_OF_CONDUCT.md and prohibit deceptive non-consensual impersonation.',
    verificationArtifact: 'CODE_OF_CONDUCT.md',
  },
  {
    step: 25, phaseId: 'phase_6_execution_governance', slug: 'crisis-rollback-and-social-killswitch', editionScope: 'CLOUD_SAAS',
    titleVi: 'Hệ thống ứng phó sự cố, Rollback SHA & Cầu dao ngắt khẩn cấp', titleEn: 'Crisis Rollback, SHA Parity & Social Publisher Killswitch',
    businessRule: 'GitHub Actions deploy with bit-for-bit /api/version SHA check and instant channel killswitches.',
    agenticRole: 'Ops and CTO agents monitor circuit breakers, worker logs, and SECURITY.md reports.',
    governanceGate: 'Immediate Wrangler rollback on SHA drift or critical regression in protected flows.',
    verificationArtifact: 'SECURITY.md', linkedFeatureId: 'managed_social_oauth_relay',
  },
] as const;
