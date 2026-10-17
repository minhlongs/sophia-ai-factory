/**
 * Types & Phase Metadata for the 25-Step Open-Core Public GitHub + SaaS Blueprint
 *
 * Codifies the 6 phases and 25 steps of Sophia AI Factory's Open-Core (`Apache-2.0`)
 * + Managed Cloud SaaS (`$199–$799/mo`) & Enterprise RaaS (`$4,999`) architecture.
 *
 * Layer: seed/config
 * @module seed/config/open-core-25-steps-types
 */

import type { LicenseScopeTier, SophiaModuleFeatureId } from './open-core-manifest';

export type OpenCorePhaseId =
  | 'phase_1_foundation'
  | 'phase_2_business_model'
  | 'phase_3_brand_github_community'
  | 'phase_4_revenue_conversion_engine'
  | 'phase_5_operations_security_readiness'
  | 'phase_6_execution_governance';

export type OpenCoreStepEditionScope = LicenseScopeTier | 'HYBRID';

export interface OpenCorePhaseMetadata {
  readonly id: OpenCorePhaseId;
  readonly order: 1 | 2 | 3 | 4 | 5 | 6;
  readonly titleVi: string;
  readonly titleEn: string;
  readonly stepRange: readonly [number, number];
}

export interface OpenCoreStepDefinition {
  readonly step: number;
  readonly phaseId: OpenCorePhaseId;
  readonly slug: string;
  readonly editionScope: OpenCoreStepEditionScope;
  readonly titleVi: string;
  readonly titleEn: string;
  readonly businessRule: string;
  readonly agenticRole: string;
  readonly governanceGate: string;
  readonly verificationArtifact: string;
  readonly linkedFeatureId?: SophiaModuleFeatureId;
}

export const OPEN_CORE_PHASES: readonly OpenCorePhaseMetadata[] = [
  {
    id: 'phase_1_foundation',
    order: 1,
    titleVi: 'Giai đoạn 1 — Nền tảng Kiến trúc Open-Core',
    titleEn: 'Phase 1 — Open-Core Architecture Foundation',
    stepRange: [1, 5],
  },
  {
    id: 'phase_2_business_model',
    order: 2,
    titleVi: 'Giai đoạn 2 — Mô hình Kinh doanh & Kinh tế Đơn vị',
    titleEn: 'Phase 2 — Business Model & Unit Economics',
    stepRange: [6, 7],
  },
  {
    id: 'phase_3_brand_github_community',
    order: 3,
    titleVi: 'Giai đoạn 3 — Thương hiệu, Cộng đồng GitHub & Nội dung',
    titleEn: 'Phase 3 — Brand, Open-Source Community & Content',
    stepRange: [8, 12],
  },
  {
    id: 'phase_4_revenue_conversion_engine',
    order: 4,
    titleVi: 'Giai đoạn 4 — Động cơ Doanh thu & Chuyển đổi PLG',
    titleEn: 'Phase 4 — Revenue & PLG Conversion Engine',
    stepRange: [13, 15],
  },
  {
    id: 'phase_5_operations_security_readiness',
    order: 5,
    titleVi: 'Giai đoạn 5 — Vận hành, Bảo mật & Sẵn sàng Kiểm toán',
    titleEn: 'Phase 5 — Operations, Security & Audit Readiness',
    stepRange: [16, 21],
  },
  {
    id: 'phase_6_execution_governance',
    order: 6,
    titleVi: 'Giai đoạn 6 — Thực thi OKR & Quản trị Rủi ro',
    titleEn: 'Phase 6 — Execution, OKRs & Crisis Governance',
    stepRange: [22, 25],
  },
] as const;
