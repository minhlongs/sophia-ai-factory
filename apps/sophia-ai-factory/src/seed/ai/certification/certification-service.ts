/**
 * @module seed/ai/certification/certification-service
 * Provider resolution service with automatic fallback diversion.
 */

import {
  type CertifiedProviderResolution,
} from './types';
import { getCertification } from './capability-matrix';
import {
  isCertificationBlocking,
  ProviderNotCertifiedError,
} from './policy-evaluator';

/**
 * Resolves a certified provider for text reasoning, prompt optimization, or AI operations.
 *
 * If preferredProvider is NOT blocked by certification, returns it directly with diverted = false.
 * If preferredProvider IS blocked by certification (e.g. 'hermes'), actively diverts to the first
 * non-blocking fallback candidate (defaulting to ['openrouter', 'anthropic']) with diverted = true.
 *
 * If ALL candidates are blocked (or none provided), throws ProviderNotCertifiedError.
 *
 * @param preferredProvider - The requested provider (default: 'hermes')
 * @param fallbackCandidates - Ordered fallback list (default: ['openrouter', 'anthropic'])
 * @returns CertifiedProviderResolution
 * @throws ProviderNotCertifiedError if preferred and all fallback candidates are blocked
 */
export function resolveCertifiedProvider(
  preferredProvider = 'hermes',
  fallbackCandidates: readonly string[] = ['openrouter', 'anthropic'],
): CertifiedProviderResolution {
  const isPreferredBlocked = isCertificationBlocking(preferredProvider);
  const preferredCert = getCertification(preferredProvider);

  if (!isPreferredBlocked) {
    return {
      provider: preferredProvider,
      diverted: false,
      originalProvider: preferredProvider,
      originalState: preferredCert.state,
    };
  }

  // Actively find the first certified fallback
  for (const candidate of fallbackCandidates) {
    if (!isCertificationBlocking(candidate)) {
      const candidateCert = getCertification(candidate);
      return {
        provider: candidate,
        diverted: true,
        originalProvider: preferredProvider,
        originalState: preferredCert.state,
        reason: `Preferred provider '${preferredProvider}' is blocked (${preferredCert.state}). Actively diverted to certified provider '${candidate}' (${candidateCert.state}).`,
      };
    }
  }

  // No certified provider available — throw typed error to prevent uncertified execution
  throw new ProviderNotCertifiedError(
    preferredProvider,
    preferredCert.state,
    `Preferred provider '${preferredProvider}' is blocked and all fallback candidates (${fallbackCandidates.join(', ')}) are uncertified or blocked.`,
  );
}
