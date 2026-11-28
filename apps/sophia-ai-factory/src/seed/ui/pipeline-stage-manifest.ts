/**
 * 5-Stage Cinematic Assembly Line Manifest for Sophia 39-Engine Live Mission Control.
 *
 * Pure seed/ui helper — maps all 39 registered engines deterministically into 5
 * causal factory stages (8 + 7 + 8 + 9 + 7 = 39) and builds the verified receipt
 * from real server telemetry.
 *
 * @module seed/ui/pipeline-stage-manifest
 */

import type {
  BilingualText,
  CapabilityCategory,
  StudioCapabilitySpec,
} from '@/seed/ui/studio-capability-registry';
import type { EngineLiveTelemetry } from '@/seed/ui/live-pipeline-runner';

export type PipelineStageId =
  | 'script-policy'
  | 'audio-video'
  | 'edge-shield'
  | 'distribution-bandit'
  | 'revenue-ledger';

export interface PipelineStageGroup {
  readonly id: PipelineStageId;
  readonly stepNumber: 1 | 2 | 3 | 4 | 5;
  readonly title: BilingualText;
  readonly subtitle: BilingualText;
  readonly capabilities: readonly StudioCapabilitySpec[];
}

export interface PipelineVerifiedReceipt {
  readonly executedAt: string;
  readonly telemetrySource: 'live_d1' | 'default_sample';
  readonly totalEngines: number;
  readonly passedCount: number;
  readonly warningCount: number;
  readonly blockedCount: number;
  readonly totalComputeMs: number;
  readonly subIdWatermark: string;
  readonly waterfallSplit: string;
  readonly reconciliationVerdict: string;
}

interface StageSpec {
  readonly id: PipelineStageId;
  readonly stepNumber: 1 | 2 | 3 | 4 | 5;
  readonly title: BilingualText;
  readonly subtitle: BilingualText;
  readonly engineIds: readonly string[];
}

const STAGE_SPECS: readonly StageSpec[] = [
  {
    id: 'script-policy',
    stepNumber: 1,
    title: { vi: '1. Kịch bản & Luật', en: '1. Script & Policy' },
    subtitle: { vi: 'Hook, SEO & Tuân thủ', en: 'Hook, SEO & Compliance' },
    engineIds: [
      'comment-pain-point-miner',
      'hook-beat-evaluator',
      'schema-aligned-repair',
      'policy-preflight-engine',
      'ftc-disclosure-injector',
      'youtube-preflight-validator',
      'landing-preflight-linter',
      'byok-fallback-router',
    ],
  },
  {
    id: 'audio-video',
    stepNumber: 2,
    title: { vi: '2. Âm thanh & Video', en: '2. Audio & Video' },
    subtitle: { vi: '9:16 WebCodecs $0 GPU', en: '9:16 WebCodecs $0 GPU' },
    engineIds: [
      'broll-scene-matcher',
      'frame1-hook-scorer',
      'timeline-isolated-srt',
      'kinetic-captions',
      'audio-loudness-normalizer',
      'webcodecs-timeline-spec',
      'carousel-svg-builder',
    ],
  },
  {
    id: 'edge-shield',
    stepNumber: 3,
    title: { vi: '3. Khiên Edge & SubID', en: '3. Edge Shield & SubID' },
    subtitle: { vi: 'HMAC, ASN & Chống Bot', en: 'HMAC, ASN & Anti-Bot' },
    engineIds: [
      'subid-watermark-encoder',
      'creator-va-rbac',
      'byok-key-rotation',
      'bot-user-agent-filter',
      'asn-click-fraud-shield',
      'geo-failover-router',
      'capi-webhook-verifier',
      'cookieless-attribution',
    ],
  },
  {
    id: 'distribution-bandit',
    stepNumber: 4,
    title: { vi: '4. Phân phối & A/B', en: '4. Distribution & Bandit' },
    subtitle: { vi: 'Đa kênh & Thompson EPC', en: 'Omnichannel & Bandit' },
    engineIds: [
      'content-atomizer',
      'autogeo-citation-rules',
      'optimal-publish-window',
      'account-warmup-fsm',
      'creator-cadence-engine',
      'delayed-comment-plug',
      'comment-to-dm-fsm',
      'concierge-funnel-fsm',
      'thompson-bandit-engine',
    ],
  },
  {
    id: 'revenue-ledger',
    stepNumber: 5,
    title: { vi: '5. Doanh thu & Sổ BigInt', en: '5. Revenue & BigInt' },
    subtitle: { vi: 'Đối soát 3 chiều & Thuế', en: '3-Way Recon & Tax' },
    engineIds: [
      'epc-anomaly-detector',
      'offer-drift-detector',
      'verified-media-kit',
      'cohort-ltv-forecaster',
      'integer-cent-waterfall',
      'cross-border-payout-tax',
      'affiliate-payout-reconciler',
    ],
  },
];

const CATEGORY_FALLBACK_STAGE: Record<CapabilityCategory, PipelineStageId> = {
  compliance: 'script-policy',
  video: 'audio-video',
  security: 'edge-shield',
  analytics: 'distribution-bandit',
  affiliate: 'revenue-ledger',
};

export function groupCapabilitiesIntoStages(
  capabilities: readonly StudioCapabilitySpec[],
): readonly PipelineStageGroup[] {
  const byId = new Map<string, StudioCapabilitySpec>();
  for (const cap of capabilities) {
    byId.set(cap.id, cap);
  }

  const assigned = new Set<string>();
  const buckets = new Map<PipelineStageId, StudioCapabilitySpec[]>();
  for (const spec of STAGE_SPECS) {
    const items: StudioCapabilitySpec[] = [];
    for (const id of spec.engineIds) {
      const cap = byId.get(id);
      if (cap) {
        items.push(cap);
        assigned.add(id);
      }
    }
    buckets.set(spec.id, items);
  }

  for (const cap of capabilities) {
    if (!assigned.has(cap.id)) {
      const targetStage = CATEGORY_FALLBACK_STAGE[cap.category] ?? 'revenue-ledger';
      buckets.get(targetStage)?.push(cap);
    }
  }

  return STAGE_SPECS.map((spec) => ({
    id: spec.id,
    stepNumber: spec.stepNumber,
    title: spec.title,
    subtitle: spec.subtitle,
    capabilities: buckets.get(spec.id) ?? [],
  }));
}

export function buildPipelineVerifiedReceipt(
  telemetryMap: Readonly<Record<string, EngineLiveTelemetry>>,
  executedAt: string,
  telemetrySource: 'live_d1' | 'default_sample',
  totalEngines: number,
): PipelineVerifiedReceipt {
  const values = Object.values(telemetryMap);
  const passedCount = values.filter((t) => t.state === 'passed').length;
  const warningCount = values.filter((t) => t.state === 'warning').length;
  const blockedCount = values.filter((t) => t.state === 'blocked').length;
  const totalComputeMs = values.reduce((acc, item) => acc + (item.durationMs || 0), 0);

  return {
    executedAt,
    telemetrySource,
    totalEngines,
    passedCount,
    warningCount,
    blockedCount,
    totalComputeMs: Math.round(totalComputeMs * 10) / 10,
    subIdWatermark: telemetryMap['subid-watermark-encoder']?.metricOutput ?? 'Not evaluated',
    waterfallSplit: telemetryMap['integer-cent-waterfall']?.metricOutput ?? 'Not evaluated',
    reconciliationVerdict:
      telemetryMap['affiliate-payout-reconciler']?.metricOutput ?? 'Not evaluated',
  };
}

export function formatReceiptClipboardText(
  receipt: PipelineVerifiedReceipt,
  locale: 'vi' | 'en',
): string {
  const sourceLabel =
    receipt.telemetrySource === 'live_d1'
      ? locale === 'vi'
        ? 'DỮ LIỆU D1 THỰC TẾ'
        : 'LIVE D1 DATA'
      : locale === 'vi'
        ? 'KỊCH BẢN MẪU CHUẨN'
        : 'STANDARD SAMPLE BRIEF';

  if (locale === 'vi') {
    return [
      `BIÊN NHẬN XÁC THỰC ${receipt.passedCount}/${receipt.totalEngines} ĐỘNG CƠ • SOPHIA AI FACTORY`,
      `• Nguồn dữ liệu: ${sourceLabel}`,
      `• Thời gian xử lý Edge: ${receipt.totalComputeMs.toFixed(1)}ms`,
      `• Dấu SubID HMAC: ${receipt.subIdWatermark}`,
      `• Sổ cái BigInt: ${receipt.waterfallSplit} • ${receipt.reconciliationVerdict}`,
      `• Thời điểm: ${receipt.executedAt}`,
    ].join('\n');
  }

  return [
    `SOPHIA AI FACTORY • ${receipt.passedCount}/${receipt.totalEngines} ENGINE VERIFIED RECEIPT`,
    `• Telemetry Source: ${sourceLabel}`,
    `• Edge Compute: ${receipt.totalComputeMs.toFixed(1)}ms`,
    `• S2S SubID Seal: ${receipt.subIdWatermark}`,
    `• BigInt Ledger: ${receipt.waterfallSplit} • ${receipt.reconciliationVerdict}`,
    `• Executed At: ${receipt.executedAt}`,
  ].join('\n');
}
