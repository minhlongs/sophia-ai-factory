/**
 * Approval Payload SHA-256 Hash Primitive
 *
 * Computes a deterministic Web Crypto SHA-256 hex digest over the canonical
 * fields of a campaign approval payload (script body, affiliate target URL,
 * target jurisdiction, mandatory disclosure text, and max render cost budget).
 * Any post-approval mutation to these fields changes the digest and invalidates
 * the CEO's approval before render or publication.
 *
 * Layer: seed/security (Foundational Primitive)
 * @module seed/security/approval-payload-hash
 */

export interface CampaignApprovalPayload {
  scriptBody: string;
  affiliateTargetUrl: string;
  jurisdiction: string;
  disclosureText: string;
  maxRenderCostCents: number;
  targetAccount?: string;
}

/**
 * Normalizes a campaign approval payload into a deterministic JSON string
 * with stable key ordering and trimmed strings.
 */
export function canonicalizeApprovalPayload(payload: CampaignApprovalPayload): string {
  const canonical: Record<string, string | number> = {
    affiliateTargetUrl: payload.affiliateTargetUrl.trim(),
    disclosureText: payload.disclosureText.trim(),
    jurisdiction: payload.jurisdiction.trim().toUpperCase(),
    maxRenderCostCents: Math.max(0, Math.round(payload.maxRenderCostCents)),
    scriptBody: payload.scriptBody.trim(),
  };
  if (payload.targetAccount !== undefined && payload.targetAccount.trim().length > 0) {
    canonical.targetAccount = payload.targetAccount.trim();
  }
  return JSON.stringify(canonical);
}

/**
 * Computes the lowercase hex-encoded SHA-256 digest of a canonicalized
 * CampaignApprovalPayload using standard Web Crypto API.
 */
export async function computeApprovalPayloadHash(
  payload: CampaignApprovalPayload,
): Promise<string> {
  const canonicalJson = canonicalizeApprovalPayload(payload);
  const encoded = new TextEncoder().encode(canonicalJson);
  const digestBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digestBuffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
