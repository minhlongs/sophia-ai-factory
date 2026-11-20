/**
 * Bounded manual email refund receipt review (G3):
 * RECEIVED_UNVERIFIED -> RECEIPT_EVIDENCE_ATTACHED -> RECEIPT_VERIFIED.
 * No mailbox connection, no polling, no operator credentials.
 * Layer: land/payments/manual-pilot
 */

import type { D1Database } from '@cloudflare/workers-types';
import { z } from 'zod';
import { OPTION_A_PILOT_CONTRACT } from '@/seed/config/tiers/option-a-pilot-contract';
import { safeStorageKey } from '@/seed/security/file-upload-policy';
import { failure, success, type Result } from '@/seed/types/result';
import {
  sha256BytesHex,
  type PrivateArtifactByteStore,
} from './manual-pilot-bank-artifact-intake';
import type { EmailEligibilityOutcome, EmailReceiptReviewState, ManualPilotError } from './types';

export * from './manual-pilot-email-artifact-policy';
import { openEmailReviewSchema, attachEmailEvidenceMetaSchema, detectEmailReceiptSignature, EMAIL_MIME_TO_SIG } from './manual-pilot-email-artifact-policy';

export async function openEmailRefundReceiptReview(
  db: D1Database,
  input: z.input<typeof openEmailReviewSchema>,
  adminId: string,
): Promise<Result<{
  reviewId: string;
  state: EmailReceiptReviewState;
  eligibilityOutcome: EmailEligibilityOutcome;
  idempotent: boolean;
}, ManualPilotError>> {
  const parsed = openEmailReviewSchema.safeParse(input);
  if (!parsed.success || !adminId) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Valid email refund review fields and admin required' });
  }
  const data = parsed.data;
  try {
  const existing = await db.prepare(`SELECT id, org_id, state, eligibility_outcome
    FROM manual_pilot_email_receipt_reviews WHERE order_id = ? AND category = ?
    AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
    .bind(data.orderId, data.category, adminId)
    .first<{ id: string; org_id: string; state: EmailReceiptReviewState; eligibility_outcome: EmailEligibilityOutcome }>();
  if (existing) {
    if (existing.org_id !== data.orgId) {
      return failure({ code: 'VALIDATION_ERROR', message: 'Email review order belongs to another organization' });
    }
    return success({
      reviewId: existing.id,
      state: existing.state,
      eligibilityOutcome: existing.eligibility_outcome,
      idempotent: true,
    });
  }
  const reviewId = `mper_${crypto.randomUUID()}`;
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  const windowDays = data.category === 'goodwill_7d'
    ? OPTION_A_PILOT_CONTRACT.refundPolicy.pilotGoodwillWindowDays
    : OPTION_A_PILOT_CONTRACT.refundPolicy.pilotDeliveryFailureWindowDays;
    const [inserted] = await db.batch([
      db.prepare(`INSERT INTO manual_pilot_email_receipt_reviews
        (id,order_id,org_id,user_id,category,state,eligibility_outcome,reason,
         beneficiary_bank_identity,beneficiary_account_identity,sender_email,
         untrusted_sender_date_header,opened_by_admin_id,opened_at,
         policy_timezone,policy_window_days,policy_version,updated_at)
        SELECT ?,s.order_id,s.org_id,s.user_id,?,'RECEIVED_UNVERIFIED','PENDING_MANUAL_REVIEW',
          ?,?,?,?,?,?,?,'Asia/Ho_Chi_Minh',?,?,?
        FROM manual_pilot_settlements s
        JOIN manual_pilot_financial_state f USING(order_id)
        WHERE s.order_id=? AND s.org_id=? AND f.org_id=s.org_id AND s.sku_code=?
          AND s.status='activated' AND f.state='ACTIVE_14D'
          AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
        .bind(reviewId, data.category, data.reason, data.beneficiaryBankIdentity,
          data.beneficiaryAccountIdentity, data.senderEmail ?? null,
          data.untrustedSenderDateHeader ?? null, adminId, now, windowDays,
          OPTION_A_PILOT_CONTRACT.termsVersion, now, data.orderId, data.orgId,
          OPTION_A_PILOT_CONTRACT.skuCode, adminId),
      db.prepare(`INSERT INTO manual_pilot_email_review_events
        (id,review_id,order_id,from_state,to_state,actor_id,eligibility_outcome,created_at)
        SELECT ?,id,order_id,'NONE','RECEIVED_UNVERIFIED',opened_by_admin_id,eligibility_outcome,opened_at
        FROM manual_pilot_email_receipt_reviews WHERE id=?`)
        .bind(eventId, reviewId),
      db.prepare(`SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM manual_pilot_email_receipt_reviews WHERE id=?)
        OR EXISTS(SELECT 1 FROM manual_pilot_email_review_events WHERE id=? AND review_id=?)
        THEN 'true' ELSE 'missing email review open audit' END)`)
        .bind(reviewId, eventId, reviewId),
    ]);
    if ((inserted.meta?.changes ?? 0) !== 1) {
      return failure({ code: 'INVALID_STATE', message: 'Active admin and active tenant pilot order required' });
    }
    return success({
      reviewId,
      state: 'RECEIVED_UNVERIFIED',
      eligibilityOutcome: 'PENDING_MANUAL_REVIEW',
      idempotent: false,
    });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Unable to open email refund receipt review' });
  }
}

export async function attachEmailReceiptEvidence(
  db: D1Database,
  input: z.input<typeof attachEmailEvidenceMetaSchema> & { bytes: Uint8Array },
  adminId: string,
  byteStore: PrivateArtifactByteStore,
): Promise<Result<{
  reviewId: string;
  state: EmailReceiptReviewState;
  storageKey: string;
  artifactSha256: string;
}, ManualPilotError>> {
  const { bytes, ...meta } = input;
  const parsed = attachEmailEvidenceMetaSchema.safeParse(meta);
  if (!parsed.success || !adminId || !(bytes instanceof Uint8Array)) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Valid email receipt artifact metadata and bytes required' });
  }
  const detected = detectEmailReceiptSignature(bytes);
  if (!detected || detected !== EMAIL_MIME_TO_SIG[parsed.data.mimeType]) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Email receipt file signature does not match declared MIME type' });
  }
  if (parsed.data.filename.includes('..') || parsed.data.filename.includes('/') || parsed.data.filename.includes('\\')) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Invalid email receipt filename' });
  }
  const artifactSha256 = await sha256BytesHex(bytes);
  if (parsed.data.expectedSha256 && parsed.data.expectedSha256.toLowerCase() !== artifactSha256) {
    return failure({ code: 'VALIDATION_ERROR', message: 'Email receipt SHA-256 mismatch' });
  }
  const safeOrg = parsed.data.orgId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeOrder = parsed.data.orderId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const storageKey = safeStorageKey('private', `manual-pilot-email-receipts/${safeOrg}/${safeOrder}`, `${crypto.randomUUID()}.${detected}`);
  const now = new Date().toISOString();
  const eventId = crypto.randomUUID();
  try {
    await byteStore.put(storageKey, bytes, { contentType: parsed.data.mimeType, sha256: artifactSha256 });
    const [updated] = await db.batch([
      db.prepare(`UPDATE manual_pilot_email_receipt_reviews
        SET state='RECEIPT_EVIDENCE_ATTACHED', artifact_storage_key=?, artifact_mime_type=?,
            artifact_byte_size=?, artifact_sha256=?, updated_at=?
        WHERE id=? AND order_id=? AND org_id=? AND state='RECEIVED_UNVERIFIED'
          AND EXISTS(SELECT 1 FROM user_profiles WHERE user_id=? AND role='admin')`)
        .bind(storageKey, parsed.data.mimeType, bytes.byteLength, artifactSha256, now,
          parsed.data.reviewId, parsed.data.orderId, parsed.data.orgId, adminId),
      db.prepare(`INSERT INTO manual_pilot_email_review_events
        (id,review_id,order_id,from_state,to_state,actor_id,eligibility_outcome,created_at)
        SELECT ?,id,order_id,'RECEIVED_UNVERIFIED','RECEIPT_EVIDENCE_ATTACHED',?,eligibility_outcome,?
        FROM manual_pilot_email_receipt_reviews WHERE id=? AND state='RECEIPT_EVIDENCE_ATTACHED' AND updated_at=?`)
        .bind(eventId, adminId, now, parsed.data.reviewId, now),
      db.prepare(`SELECT json(CASE WHEN NOT EXISTS(SELECT 1 FROM manual_pilot_email_receipt_reviews WHERE id=? AND updated_at=?)
        OR EXISTS(SELECT 1 FROM manual_pilot_email_review_events WHERE id=? AND review_id=?)
        THEN 'true' ELSE 'missing email evidence attach audit' END)`)
        .bind(parsed.data.reviewId, now, eventId, parsed.data.reviewId),
    ]);
    if ((updated.meta?.changes ?? 0) !== 1) {
      return failure({ code: 'INVALID_STATE', message: 'Review must be RECEIVED_UNVERIFIED with active admin' });
    }
    return success({ reviewId: parsed.data.reviewId, state: 'RECEIPT_EVIDENCE_ATTACHED', storageKey, artifactSha256 });
  } catch {
    return failure({ code: 'DB_ERROR', message: 'Unable to attach email receipt evidence' });
  }
}
