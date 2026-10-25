/**
 * 25-Step Open-Core Public GitHub + SaaS Monetization Catalog & Lookup Helpers
 *
 * Unifies Part 1 (Steps 1–12) and Part 2 (Steps 13–25) into the canonical
 * 25-step catalog and provides typed query helpers for the Tree Readiness Auditor,
 * Status API, and Settings UI.
 *
 * Path base: every `verificationArtifact` and every `REQUIRED_GITHUB_COMMUNITY_FILES`
 * entry resolves from the **git repository root**, not from `apps/sophia-ai-factory/`.
 * The root is the public Apache-2.0 repo a self-hoster clones, so license and
 * governance files live there while app code lives under the `apps/` prefix.
 *
 * Layer: seed/config
 * @module seed/config/open-core-25-steps-catalog
 */

import {
  OPEN_CORE_PHASES,
  type OpenCorePhaseId,
  type OpenCorePhaseMetadata,
  type OpenCoreStepDefinition,
  type OpenCoreStepEditionScope,
} from './open-core-25-steps-types';
import { OPEN_CORE_STEPS_PART_1 } from './open-core-25-steps-data-p1';
import { OPEN_CORE_STEPS_PART_2 } from './open-core-25-steps-data-p2';

export {
  BINH_PHAP_THIEN,
  BINH_PHAP_STEP_MAPPING,
  BINH_PHAP_TOTAL_THIEN,
  getBinhPhapThienByNumber,
  getBinhPhapThienForStep,
  evaluateBinhPhapCoverage,
} from './open-core-25-steps-binh-phap-map';

export {
  OPEN_CORE_PHASES,
  type OpenCorePhaseId,
  type OpenCorePhaseMetadata,
  type OpenCoreStepDefinition,
  type OpenCoreStepEditionScope,
};

export const TOTAL_OPEN_CORE_STEPS = 25 as const;

/**
 * The base every path in this catalog is written against. Recorded as data so a
 * future existence check or a self-hoster reading the UI resolves against the
 * same directory instead of guessing between the repo root and the app folder.
 */
export const ARTIFACT_RESOLUTION_BASE = 'repo-root' as const;

export const OPEN_CORE_25_STEPS: readonly OpenCoreStepDefinition[] = [
  ...OPEN_CORE_STEPS_PART_1,
  ...OPEN_CORE_STEPS_PART_2,
];

export const REQUIRED_GITHUB_COMMUNITY_FILES: readonly string[] = [
  'LICENSE',
  'LICENSE-COMMERCIAL.md',
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CODE_OF_CONDUCT.md',
  'docs/SELF_HOSTING.md',
  '.mekong/company.json',
  'plans/company-blueprint/plan.md',
  'plans/company-blueprint/tasks.md',
] as const;

export const PROTECTED_OPEN_CORE_FLOWS = [
  {
    id: 'setup_wizard_byok',
    nameVi: 'Trình cài đặt BYOK (OpenRouter, ElevenLabs, HeyGen, D-ID)',
    nameEn: 'Setup Wizard BYOK Onboarding',
    routePath: 'src/app/api/setup-wizard/save-credentials/route.ts',
  },
  {
    id: 'telegram_bot_commands',
    nameVi: 'Telegram Bot @Sophia_Bbot (/campaign, /status, /results)',
    nameEn: 'Telegram Bot @Sophia_Bbot Webhook Commands',
    routePath: 'src/app/api/webhooks/telegram/route.ts',
  },
  {
    id: 'nowpayments_ipn_webhook',
    nameVi: 'Luồng thanh toán NOWPayments IPN -> Kích hoạt gói D1',
    nameEn: 'NOWPayments IPN Webhook -> D1 Tier Activation',
    routePath: 'src/app/api/webhooks/nowpayments/route.ts',
  },
] as const;

export function getOpenCoreStepByNumber(stepNumber: number): OpenCoreStepDefinition | undefined {
  return OPEN_CORE_25_STEPS.find((item) => item.step === stepNumber);
}

export function getOpenCoreStepsByPhase(
  phaseId: OpenCorePhaseId,
): readonly OpenCoreStepDefinition[] {
  return OPEN_CORE_25_STEPS.filter((item) => item.phaseId === phaseId);
}

export function getOpenCoreStepsByScope(
  scope: OpenCoreStepEditionScope,
): readonly OpenCoreStepDefinition[] {
  return OPEN_CORE_25_STEPS.filter((item) => item.editionScope === scope);
}
