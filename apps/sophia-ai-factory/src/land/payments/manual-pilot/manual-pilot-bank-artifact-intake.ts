/**
 * Private bank artifact intake with bounded size, MIME allowlist, magic-byte
 * signature verification, server-computed SHA-256, and protected storage key.
 * Layer: land/payments/manual-pilot
 */

import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { safeStorageKey } from '@/seed/security/file-upload-policy';
import { sha256Hex } from '@/seed/security/token-hash';
import { failure, success, type Result } from '@/seed/types/result';
import type { BankEvidenceLevel, ManualPilotError } from './types';

export const MIN_BANK_ARTIFACT_BYTES = 16;
export const MAX_BANK_ARTIFACT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_BANK_ARTIFACT_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
] as const;

export type BankArtifactMime = (typeof ALLOWED_BANK_ARTIFACT_MIMES)[number];
export type BankArtifactSignatureType = 'pdf' | 'png' | 'jpeg' | 'csv';

const MIME_TO_EXT: Record<BankArtifactMime, BankArtifactSignatureType> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'text/csv': 'csv',
};

export interface PrivateArtifactByteStore {
  put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }): Promise<void>;
}

export const bankArtifactIntakeMetaSchema = z.object({
  orderId: z.string().trim().min(3).max(128),
  orgId: z.string().trim().min(1).max(128),
  direction: z.enum(['inbound', 'outbound']),
  filename: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_BANK_ARTIFACT_MIMES),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
}).strict();

export async function sha256BytesHex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeAccountFingerprint(
  bankIdentity: string,
  accountIdentity: string,
): Promise<string> {
  const normalized = `${bankIdentity.trim().toLowerCase()}:${accountIdentity.trim().replace(/\s+/g, '')}`;
  return sha256Hex(normalized);
}

/** Detect actual file signature from raw bytes; never trust declared MIME alone. */
export function detectBankArtifactSignature(bytes: Uint8Array): BankArtifactSignatureType | null {
  if (bytes.byteLength < MIN_BANK_ARTIFACT_BYTES || bytes.byteLength > MAX_BANK_ARTIFACT_BYTES) {
    return null;
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return 'pdf';
  }
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  for (let i = 0; i < Math.min(bytes.byteLength, 512); i++) {
    if (bytes[i] === 0x00) return null;
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const trimmed = text.trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<svg') || trimmed.startsWith('<script')) {
    return null;
  }
  if (text.includes(',') && /[\r\n]/.test(text)) {
    return 'csv';
  }
  return null;
}

export async function intakePrivateBankArtifact(
  db: D1Database,
  input: z.input<typeof bankArtifactIntakeMetaSchema> & { bytes: Uint8Array },
  adminId: string,
  byteStore: PrivateArtifactByteStore,
): Promise<Result<{
  artifactId: string;
  storageKey: string;
  artifactSha256: string;
  byteSize: number;
  fileSignatureType: BankArtifactSignatureType;
  evidenceLevel: BankEvidenceLevel;
}, ManualPilotError>> {
  const { bytes, ...meta } = input;
  const parsed = bankArtifactIntakeMetaSchema.safeParse(meta);
  if (!parsed.success || !adminId || !(bytes instanceof Uint8Array)) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Valid bank artifact metadata, bytes, and admin required' });
  }
  if (bytes.byteLength < MIN_BANK_ARTIFACT_BYTES || bytes.byteLength > MAX_BANK_ARTIFACT_BYTES) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Bank artifact size outside allowed bounds (16B-5MiB)' });
  }
  const detected = detectBankArtifactSignature(bytes);
  const expectedType = MIME_TO_EXT[parsed.data.mimeType];
  if (!detected || detected !== expectedType) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Bank artifact file signature does not match declared MIME type' });
  }
  if (parsed.data.filename.includes('..') || parsed.data.filename.includes('/') || parsed.data.filename.includes('\\')) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Invalid bank artifact filename' });
  }
  const artifactSha256 = await sha256BytesHex(bytes);
  if (parsed.data.expectedSha256 && parsed.data.expectedSha256.toLowerCase() !== artifactSha256) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Bank artifact SHA-256 digest mismatch' });
  }
  const artifactId = `mpba_${crypto.randomUUID()}`;
  const safeOrg = parsed.data.orgId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeOrder = parsed.data.orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
  let storageKey: string;
  try {
    storageKey = safeStorageKey('private', `manual-pilot-bank-artifacts/${safeOrg}/${safeOrder}`, `${artifactId}.${detected}`);
  } catch {
    return failure({ code: 'VALIDATION_ERROR', message: 'Unable to derive protected bank artifact storage key' });
  }
  const now = new Date().toISOString();
  const auditEventId = crypto.randomUUID();
  try {
    const allowedStates = parsed.data.direction === 'inbound'
      ? "f.state IN ('PENDING_ORDER','BANK_SETTLEMENT_VERIFIED','RECONCILED')"
      : "f.state = 'ACTIVE_14D'";
    await byteStore.put(storageKey, bytes, { contentType: parsed.data.mimeType, sha256: artifactSha256 });
    const [insert] = await db.batch([
      db.prepare(`INSERT INTO manual_pilot_bank_artifacts
        (id,order_id,org_id,direction,evidence_level,storage_key,original_filename,
         mime_type,file_signature_type,byte_size,artifact_sha256,uploaded_by_admin_id,received_at)
        SELECT ?,s.order_id,f.org_id,?,'BANK_RECORD_RECEIVED',?,?,?,?,?,?,?,?
        FROM manual_pilot_settlements s
        JOIN manual_pilot_financial_state f USING(order_id)
        WHERE s.order_id=? AND f.org_id=? AND s.org_id=f.org_id AND ${allowedStates}
          AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
        .bind(artifactId, parsed.data.direction, storageKey, parsed.data.filename,
          parsed.data.mimeType, detected, bytes.byteLength, artifactSha256, adminId, now,
          parsed.data.orderId, parsed.data.orgId, adminId),
      db.prepare(`INSERT INTO manual_pilot_financial_events
        (id,order_id,from_state,to_state,actor_id,evidence_id,created_at)
        SELECT ?,order_id,'UNTRUSTED_CUSTOMER_CLAIM','BANK_RECORD_RECEIVED',uploaded_by_admin_id,id,received_at
        FROM manual_pilot_bank_artifacts WHERE id=?`)
        .bind(auditEventId, artifactId),
      db.prepare(`SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM manual_pilot_bank_artifacts WHERE id=?)
        OR EXISTS(SELECT 1 FROM manual_pilot_bank_artifacts a JOIN manual_pilot_financial_events e
          ON e.id=? AND e.order_id=a.order_id AND e.evidence_id=a.id AND e.to_state='BANK_RECORD_RECEIVED'
          WHERE a.id=?) THEN 'true' ELSE 'missing bank artifact audit' END)`)
        .bind(artifactId, auditEventId, artifactId),
    ]);
    if ((insert.meta?.changes ?? 0) !== 1) {
      return failure({ code: 'INVALID_STATE', message: 'Active admin and compatible tenant order required for bank artifact intake' });
    }
    return success({
      artifactId,
      storageKey,
      artifactSha256,
      byteSize: bytes.byteLength,
      fileSignatureType: detected,
      evidenceLevel: 'BANK_RECORD_RECEIVED',
    });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Unable to persist private bank artifact' });
  }
}
