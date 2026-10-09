/**
 * SOX 404 Control Ledger: Cryptographic Attestation Certificate Generator
 *
 * Generates formal bilingual Sarbanes-Oxley Section 302/404 Management
 * Attestation Certificates with Merkle root anchoring & HMAC signatures.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/sox404/attestation-generator
 */

import type {
  SoxEvaluationSummary,
  SoxAttestationCertificate,
} from '@/seed/types/ipo-filing';
import {
  hmacSha256Hex,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';

export async function generateCryptographicAttestation(
  summary: SoxEvaluationSummary,
  certifierId: string,
  certifierRole: string = 'CFO / Principal Financial Officer',
  periodKey: string = '2026-Q3'
): Promise<SoxAttestationCertificate> {
  const timestamp = Date.now();
  const rawCertId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '')
    : Math.random().toString(36).substring(2, 18);
  const certificateId = `SOX-CERT-${periodKey}-${rawCertId.substring(0, 8).toUpperCase()}`;

  const statementEn =
    `Pursuant to Section 302 and Section 404 of the Sarbanes-Oxley Act of 2002, the certifying officers of ` +
    `Sophia AI Factory attest that: (1) we have reviewed the financial records and Form S-1 filing for period ${periodKey}; ` +
    `(2) based on our evaluation of internal controls over financial reporting (ICFR), all 6 canonical controls were tested; ` +
    `(3) the overall ICFR status is '${summary.overallStatus.toUpperCase()}' with ${summary.effectiveControlsCount}/${summary.totalControlsTested} controls effective; ` +
    `(4) Merkle root hash ${summary.merkleRootHash} anchors all test evidence with cryptographic tamper-resistance.`;

  const statementVi =
    `Căn cứ theo Điều 302 và Điều 404 của Đạo luật Sarbanes-Oxley năm 2002, các cán bộ chứng nhận của ` +
    `Sophia AI Factory xác nhận rằng: (1) chúng tôi đã kiểm duyệt sổ sách tài chính và hồ sơ Form S-1 cho kỳ ${periodKey}; ` +
    `(2) dựa trên kết quả đánh giá hệ thống kiểm soát nội bộ đối với báo cáo tài chính (ICFR), toàn bộ 6 kiểm soát chuẩn mực đã được kiểm thử; ` +
    `(3) trạng thái ICFR tổng thể đạt '${summary.overallStatus.toUpperCase()}' với ${summary.effectiveControlsCount}/${summary.totalControlsTested} kiểm soát hữu hiệu; ` +
    `(4) mã băm Merkle root ${summary.merkleRootHash} neo giữ toàn bộ bằng chứng kiểm toán chống giả mạo bằng mật mã học.`;

  const signaturePayload = `${certificateId}:${periodKey}:${certifierId}:${summary.overallStatus}:${summary.merkleRootHash}`;
  const digitalSignature = await hmacSha256Hex(signaturePayload, DEFAULT_AUDIT_SECRET);

  return {
    certificateId,
    periodKey,
    soxStatus: summary.overallStatus,
    certifierId,
    certifierRole,
    signedAt: timestamp,
    merkleRootHash: summary.merkleRootHash,
    digitalSignature,
    statementEn,
    statementVi,
  };
}
