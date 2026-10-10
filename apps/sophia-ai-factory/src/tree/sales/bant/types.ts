/**
 * BANT Scoring Types & Domain Constants
 *
 * Layer: tree/sales/bant
 */

export const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'aol.com',
  'mail.com',
  'gmx.com',
  'yandex.com',
]);

/**
 * Checks whether an email address belongs to a corporate custom domain.
 */
export function isCorporateEmailDomain(email?: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.has(domain);
}
