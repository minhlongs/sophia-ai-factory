/**
 * Creative Identity Errors, Row Schema & Mappers
 * Layer: tree/creative-identity/types
 */

import type { CreativeIdentity } from '@/seed/types/creative-domain';

export class CreativeIdentityError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'CreativeIdentityError';
    this.code = code;
  }
}

export interface CreativeIdentityRow {
  id: string;
  workspace_id: string;
  brand_id: string | null;
  voice_description: string;
  tone: string;
  formality: number;
  energy: number;
  beliefs: string;
  positioning: string;
  target_audience: string;
  forbidden_patterns: string;
  required_disclosures: string;
  preferred_formats: string;
  reference_works: string;
  version: number;
  is_active: number;
  created_at: number;
  updated_at: number;
  updated_by: string;
}

export function rowToDomain(row: CreativeIdentityRow): CreativeIdentity {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    brandId: row.brand_id ?? undefined,
    voiceDescription: row.voice_description,
    tone: row.tone as CreativeIdentity['tone'],
    formality: row.formality,
    energy: row.energy,
    beliefs: JSON.parse(row.beliefs) as string[],
    positioning: row.positioning,
    targetAudience: row.target_audience,
    forbiddenPatterns: JSON.parse(row.forbidden_patterns) as string[],
    requiredDisclosures: JSON.parse(row.required_disclosures) as string[],
    preferredFormats: JSON.parse(row.preferred_formats) as CreativeIdentity['preferredFormats'],
    referenceWorks: JSON.parse(row.reference_works) as string[],
    version: row.version,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

export function domainToRow(
  identity: CreativeIdentity,
): Omit<CreativeIdentityRow, 'created_at' | 'updated_at'> & { created_at: number; updated_at: number } {
  return {
    id: identity.id,
    workspace_id: identity.workspaceId,
    brand_id: identity.brandId ?? null,
    voice_description: identity.voiceDescription,
    tone: identity.tone,
    formality: identity.formality,
    energy: identity.energy,
    beliefs: JSON.stringify(identity.beliefs),
    positioning: identity.positioning,
    target_audience: identity.targetAudience,
    forbidden_patterns: JSON.stringify(identity.forbiddenPatterns),
    required_disclosures: JSON.stringify(identity.requiredDisclosures),
    preferred_formats: JSON.stringify(identity.preferredFormats),
    reference_works: JSON.stringify(identity.referenceWorks),
    version: identity.version,
    is_active: identity.isActive ? 1 : 0,
    created_at: identity.createdAt,
    updated_at: identity.updatedAt,
    updated_by: identity.updatedBy,
  };
}

export function newIdentityId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'ci_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
