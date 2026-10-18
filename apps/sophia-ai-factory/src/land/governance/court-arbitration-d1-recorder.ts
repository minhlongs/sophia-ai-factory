/**
 * @file court-arbitration-d1-recorder.ts
 * @layer land/governance
 * @description Shared D1 persistence helper for Pan-Cosmic, Planetary, and Universal Court arbitrations.
 */

import { getD1 } from '@/seed/db/client';
import type { PanCosmicDisputeInput, PanCosmicDisputeRuling } from '@/tree/governance/pan-cosmic-conclave-engine';
import type { PlanetaryDisputeInput, PlanetaryCourtVerdictOutput } from '@/tree/governance/planetary-court-engine';
import type { UniversalDisputeInput, UniversalCourtVerdictOutput } from '@/tree/governance/universal-court-engine';

export interface CourtArbitrationPersistInput {
  tableName:
    | 'pan_cosmic_conclave_arbitrations'
    | 'planetary_court_arbitrations'
    | 'universal_court_arbitrations';
  id: string;
  disputeCaseRef: string;
  claimantParticipantId: string;
  respondentParticipantId: string;
  disputeValueCents: number;
  contractRootColumn: 'contract_stark_root' | 'contract_merkle_root';
  contractRootValue: string;
  evidenceSha256: string;
  jurorCountColumn: 'conclave_juror_count' | 'juror_count';
  totalJurors: number;
  supermajorityThresholdPct: number;
  verdict: string;
  jurorsSlashedCount: number;
  executedRemedyCents: number;
  resolvedAt: string | null;
}

export async function recordCourtArbitrationRuling(p: CourtArbitrationPersistInput): Promise<void> {
  const db = await getD1();
  if (!db) return;

  await db
    .prepare(
      `INSERT INTO ${p.tableName} (id, dispute_case_ref, claimant_participant_id, respondent_participant_id, dispute_value_cents, ${p.contractRootColumn}, evidence_sha256, ${p.jurorCountColumn}, supermajority_threshold_pct, verdict, jurors_slashed_count, executed_remedy_cents, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      p.id, p.disputeCaseRef, p.claimantParticipantId, p.respondentParticipantId,
      p.disputeValueCents, p.contractRootValue, p.evidenceSha256, p.totalJurors,
      p.supermajorityThresholdPct, p.verdict, p.jurorsSlashedCount,
      p.executedRemedyCents, p.resolvedAt,
    )
    .run();
}

export async function persistPanCosmicArbitration(
  params: PanCosmicDisputeInput,
  data: PanCosmicDisputeRuling,
): Promise<void> {
  await recordCourtArbitrationRuling({
    tableName: 'pan_cosmic_conclave_arbitrations',
    id: crypto.randomUUID(),
    disputeCaseRef: params.disputeCaseRef,
    claimantParticipantId: params.claimantParticipantId,
    respondentParticipantId: params.respondentParticipantId,
    disputeValueCents: params.disputeValueCents,
    contractRootColumn: 'contract_stark_root',
    contractRootValue: data.rulingHash,
    evidenceSha256: params.evidenceSha256,
    jurorCountColumn: 'conclave_juror_count',
    totalJurors: data.totalJurors,
    supermajorityThresholdPct: params.supermajorityThresholdPct ?? 98.0,
    verdict: data.verdict,
    jurorsSlashedCount: data.jurorsSlashedCount,
    executedRemedyCents: data.executedRemedyCents,
    resolvedAt: new Date().toISOString(),
  });
}

export async function persistPlanetaryArbitration(
  params: PlanetaryDisputeInput,
  data: PlanetaryCourtVerdictOutput,
): Promise<void> {
  await recordCourtArbitrationRuling({
    tableName: 'planetary_court_arbitrations',
    id: `court_${Date.now()}`,
    disputeCaseRef: params.disputeCaseRef,
    claimantParticipantId: params.claimantParticipantId,
    respondentParticipantId: params.respondentParticipantId,
    disputeValueCents: params.disputeValueCents,
    contractRootColumn: 'contract_merkle_root',
    contractRootValue: 'CONTRACT_ROOT_PLACEHOLDER',
    evidenceSha256: params.evidenceSha256,
    jurorCountColumn: 'juror_count',
    totalJurors: data.totalJurors,
    supermajorityThresholdPct: params.supermajorityThresholdPct ?? 75.0,
    verdict: data.verdict,
    jurorsSlashedCount: data.jurorsSlashedCount,
    executedRemedyCents: data.executedRemedyCents,
    resolvedAt: data.verdict !== 'DELIBERATING' ? new Date().toISOString() : null,
  });
}

export async function persistUniversalArbitration(
  params: UniversalDisputeInput,
  data: UniversalCourtVerdictOutput,
): Promise<void> {
  await recordCourtArbitrationRuling({
    tableName: 'universal_court_arbitrations',
    id: `ucourt_${Date.now()}`,
    disputeCaseRef: params.disputeCaseRef,
    claimantParticipantId: params.claimantParticipantId,
    respondentParticipantId: params.respondentParticipantId,
    disputeValueCents: params.disputeValueCents,
    contractRootColumn: 'contract_stark_root',
    contractRootValue: 'STARK_CONTRACT_ROOT_PLACEHOLDER',
    evidenceSha256: params.evidenceSha256,
    jurorCountColumn: 'juror_count',
    totalJurors: data.totalJurors,
    supermajorityThresholdPct: params.supermajorityThresholdPct ?? 80.0,
    verdict: data.verdict,
    jurorsSlashedCount: data.jurorsSlashedCount,
    executedRemedyCents: data.executedRemedyCents,
    resolvedAt: data.verdict !== 'DELIBERATING' ? new Date().toISOString() : null,
  });
}
