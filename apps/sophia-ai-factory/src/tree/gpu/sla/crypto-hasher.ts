/**
 * Cryptographic Audit Hash for SLA Penalty Escrow
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/gpu/sla/crypto-hasher
 */

/**
 * Computes a deterministic SHA-256 audit hash for an SLA escrow state.
 */
export async function generateEscrowAuditHash(payload: {
  tenantId: string;
  contractId: string;
  periodMonth: string;
  downtimeSeconds: number;
  balanceCents: number;
  breachTier: string;
}): Promise<string> {
  const canonicalString = [
    payload.tenantId,
    payload.contractId,
    payload.periodMonth,
    payload.downtimeSeconds.toFixed(4),
    payload.balanceCents.toString(),
    payload.breachTier,
  ].join('::');

  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
