/**
 * Acceptance Client Submodule: Sign-off Submission Handler & Types.
 * Layer: forest/components (UI presentation; imports from @/seed and @/tree)
 *
 * @module forest/components/handover/acceptance/acceptance-signoff-submit
 */

import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
} from '@/seed/handover/handover-types';
import type { Result } from '@/seed/types/result';
import { CANONICAL_ACCEPTANCE_STATEMENTS } from '@/tree/handover/handover-certificate-engine';

export type SignAcceptanceAction = (
  input: HandoverAcceptanceInput,
) => Promise<
  Result<
    { certificate: HandoverCertificate; record: CustomerHandoverRecord },
    { code: string; message: string }
  >
>;

export interface UseAcceptanceSignoffParams {
  handover: CustomerHandoverRecord;
  initialCertificate: HandoverCertificate | null;
  onSignAction?: SignAcceptanceAction;
}

export interface ExecuteSignAcceptanceParams {
  handoverId: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  onSignAction?: SignAcceptanceAction;
  onSuccess: (certificate: HandoverCertificate, record: CustomerHandoverRecord) => void;
  onError: (message: string) => void;
}

export async function executeSignAcceptance({
  handoverId,
  signerName,
  signerEmail,
  signerRole,
  onSignAction,
  onSuccess,
  onError,
}: ExecuteSignAcceptanceParams): Promise<void> {
  try {
    if (onSignAction) {
      const res = await onSignAction({
        handoverId,
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim(),
        signerRole: signerRole.trim(),
        acceptanceStatements: CANONICAL_ACCEPTANCE_STATEMENTS,
      });

      if (res.ok) {
        onSuccess(res.value.certificate, res.value.record);
      } else {
        onError(res.error.message || 'Failed to sign acceptance certificate.');
      }
    } else {
      const res = await fetch('/api/admin/handover/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handoverId, persist: true }),
      });
      if (!res.ok) {
        throw new Error(`Verification endpoint failed with status ${res.status}`);
      }
    }
  } catch (err) {
    onError(
      err instanceof Error
        ? err.message
        : 'An unexpected error occurred during sign-off.',
    );
  }
}
