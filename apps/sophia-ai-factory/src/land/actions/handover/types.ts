/**
 * Handover action types & DTOs
 * @module land/actions/handover/types
 */

export interface ActionError {
  code: string;
  message: string;
}

export const ALLOWED_SIGNER_ROLES = new Set([
  'CEO',
  'Founder',
  'Tech_Lead',
  'Authorized_Signatory',
  'CTO',
  'Chief Executive Officer',
  'Chief Executive Officer (CEO)',
  'Chief Technology Officer',
  'Owner',
  'Administrator',
  'Operations_Director',
]);

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
