/**
 * Provider-Agnostic Key Validation Dispatcher
 * Layer: TREE (Business Logic)
 */

import { MIN_LENGTH, type ValidatorProvider, type ValidatorResult } from './types';
import { sanitizeCredential, shortFail } from './credential-sanitizer';
import {
  validateOpenRouter,
  validateAnthropic,
  validateElevenLabs,
  validateDID,
  validateMuapi,
  validateApollo,
  validateHunter,
  validateReplicate,
  validateFalAI,
} from './provider-rules';

/**
 * Provider-agnostic dispatcher used by the form. Falls back to length-only
 * check for any provider not explicitly enumerated (defensive forward-compat).
 */
export function validateProviderKey(provider: ValidatorProvider, key: string): ValidatorResult {
  switch (provider) {
    case 'openrouter':
      return validateOpenRouter(key);
    case 'anthropic':
      return validateAnthropic(key);
    case 'elevenlabs':
      return validateElevenLabs(key);
    case 'd-id':
      return validateDID(key);
    case 'muapi':
      return validateMuapi(key);
    case 'apollo':
      return validateApollo(key);
    case 'hunter':
      return validateHunter(key);
    case 'replicate':
      return validateReplicate(key);
    case 'fal-ai':
      return validateFalAI(key);
    default: {
      const trimmed = sanitizeCredential(key);
      return trimmed.length >= MIN_LENGTH ? { ok: true } : shortFail();
    }
  }
}
