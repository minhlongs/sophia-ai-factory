import type { ProvenanceRecord, ProvenanceAction } from '@/seed/types/creative-domain';
import type {
  AgentRunId,
  IProvenanceLedger,
  ProvenanceQuery,
  ProvenanceRecordId,
} from '@/seed/types/creative-economy';
import { success, failure, type Result } from '@/seed/types/result';
import { createProvenanceRecordId } from '@/seed/types/creative-economy';
import { toError } from '@/seed/utils/to-error';
import {
  recordProvenance,
  getProvenanceChain,
  getAgentRunProvenance,
  ProvenanceError,
} from '../types';
import {
  fetchProvenanceRecordById,
  fetchProvenanceByQuery,
  checkProvenanceActionExists,
} from './d1-queries';

export class ProvenanceLedger implements IProvenanceLedger {
  async append(
    record: Omit<ProvenanceRecord, 'id' | 'createdAt'>,
  ): Promise<Result<ProvenanceRecordId, Error>> {
    try {
      const saved = await recordProvenance({
        ...record,
        id: createProvenanceRecordId(),
        createdAt: Math.floor(Date.now() / 1000),
      });
      return success(createProvenanceRecordId(saved.id));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async get(id: ProvenanceRecordId): Promise<Result<ProvenanceRecord, Error>> {
    try {
      const record = await fetchProvenanceRecordById(id);
      if (!record) {
        return failure(new ProvenanceError('NOT_FOUND', `Provenance record not found: ${id}`));
      }
      return success(record);
    } catch (err) {
      return failure(toError(err));
    }
  }

  async byAsset(assetId: string): Promise<Result<ProvenanceRecord[], Error>> {
    try {
      return success(await getProvenanceChain(assetId));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async byRun(agentRunId: AgentRunId): Promise<Result<ProvenanceRecord[], Error>> {
    try {
      return success(await getAgentRunProvenance(agentRunId as string));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async query(query: ProvenanceQuery): Promise<Result<ProvenanceRecord[], Error>> {
    try {
      return success(await fetchProvenanceByQuery(query));
    } catch (err) {
      return failure(toError(err));
    }
  }

  async hasAction(
    assetId: string,
    action: ProvenanceAction,
  ): Promise<Result<boolean, Error>> {
    try {
      return success(await checkProvenanceActionExists(assetId, action));
    } catch (err) {
      return failure(toError(err));
    }
  }
}

export const provenanceLedger = new ProvenanceLedger();
