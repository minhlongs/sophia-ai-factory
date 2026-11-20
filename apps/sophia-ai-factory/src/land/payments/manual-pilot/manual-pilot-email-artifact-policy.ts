import { z } from 'zod';
import { MAX_BANK_ARTIFACT_BYTES, MIN_BANK_ARTIFACT_BYTES } from './manual-pilot-bank-artifact-intake';
export const ALLOWED_EMAIL_RECEIPT_MIMES = [
  'message/rfc822',
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

export const ALLOWED_RECEIPT_SOURCES = [
  'provider_mailbox_headers',
  'provider_eml_export',
  'mail_gateway_receipt_log',
] as const;

type EmailArtifactMime = (typeof ALLOWED_EMAIL_RECEIPT_MIMES)[number];
type EmailArtifactSig = 'eml' | 'pdf' | 'png' | 'jpeg';

export const EMAIL_MIME_TO_SIG: Record<EmailArtifactMime, EmailArtifactSig> = {
  'message/rfc822': 'eml',
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
};

export const openEmailReviewSchema = z.object({
  orderId: z.string().trim().min(3).max(128),
  orgId: z.string().trim().min(1).max(128),
  category: z.enum(['goodwill_7d', 'delivery_failure_14d']),
  reason: z.string().trim().min(5).max(500),
  beneficiaryBankIdentity: z.string().trim().min(1).max(128),
  beneficiaryAccountIdentity: z.string().trim().min(1).max(128),
  senderEmail: z.string().trim().email().max(254).optional(),
  untrustedSenderDateHeader: z.string().trim().max(128).optional(),
}).strict();

export const attachEmailEvidenceMetaSchema = z.object({
  reviewId: z.string().trim().min(5).max(128),
  orderId: z.string().trim().min(3).max(128),
  orgId: z.string().trim().min(1).max(128),
  filename: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_EMAIL_RECEIPT_MIMES),
  expectedSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
}).strict();

export function detectEmailReceiptSignature(bytes: Uint8Array): EmailArtifactSig | null {
  if (bytes.byteLength < MIN_BANK_ARTIFACT_BYTES || bytes.byteLength > MAX_BANK_ARTIFACT_BYTES) return null;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'pdf';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  for (let i = 0; i < Math.min(bytes.byteLength, 512); i++) {
    if (bytes[i] === 0x00) return null;
  }
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const lower = text.trimStart().toLowerCase();
  if (lower.startsWith('<!doctype') || lower.startsWith('<html') || lower.startsWith('<script')) return null;
  if (/^(received|message-id|delivered-to):/im.test(text) && /^from:/im.test(text)) return 'eml';
  return null;
}
