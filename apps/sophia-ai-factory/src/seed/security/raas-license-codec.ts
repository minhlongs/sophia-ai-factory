/**
 * RaaS License Key Base64URL Codec & Payload Validator
 *
 * Layer: seed/security
 * @module seed/security/raas-license-codec
 */

export interface RaasLicensePayload {
  readonly licenseId: string;
  readonly orgId: string;
  readonly edition: 'cloud' | 'enterprise';
  readonly tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly maxSubaccounts?: number;
  readonly whiteLabelEnabled?: boolean;
}

export interface RaasLicenseVerificationResult {
  readonly valid: boolean;
  readonly reason?:
    | 'MISSING_TOKEN'
    | 'MISSING_SECRET'
    | 'MALFORMED_TOKEN'
    | 'EMPTY_OR_MALFORMED_TOKEN'
    | 'SIGNATURE_MISMATCH'
    | 'INVALID_PAYLOAD'
    | 'LICENSE_EXPIRED';
  readonly payload?: RaasLicensePayload;
}

export function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Url(input: string): string | null {
  try {
    const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function isValidLicensePayload(data: unknown): data is RaasLicensePayload {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Record<string, unknown>;
  const validEditions = ['cloud', 'enterprise'];
  const validTiers = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  return (
    typeof candidate.licenseId === 'string' &&
    candidate.licenseId.length > 0 &&
    typeof candidate.orgId === 'string' &&
    candidate.orgId.length > 0 &&
    typeof candidate.edition === 'string' &&
    validEditions.includes(candidate.edition) &&
    typeof candidate.tier === 'string' &&
    validTiers.includes(candidate.tier) &&
    typeof candidate.issuedAt === 'number' &&
    typeof candidate.expiresAt === 'number'
  );
}
