/**
 * @file domain-validator.ts
 * @description Enterprise corporate domain normalization and validation against public webmail providers.
 * @layer tree
 */

export const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.co.jp',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  'yandex.com',
  'yandex.ru',
  'fastmail.com',
  'tutanota.com',
  'tuta.com',
]);

export const DOMAIN_REGEX =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * Normalizes a corporate domain string or email.
 * Strips leading '@', protocols, paths, converts to lowercase.
 *
 * @example
 * normalizeCorporateDomain("alice@AcmeCorp.COM") // "acmecorp.com"
 * normalizeCorporateDomain("@AcmeCorp.COM")      // "acmecorp.com"
 * normalizeCorporateDomain("https://acme.com/")  // "acme.com"
 */
export function normalizeCorporateDomain(domainOrEmail: string): string {
  if (!domainOrEmail || typeof domainOrEmail !== 'string') {
    return '';
  }

  let cleaned = domainOrEmail.trim().toLowerCase();

  // Strip protocol if present
  if (cleaned.startsWith('https://')) cleaned = cleaned.slice(8);
  if (cleaned.startsWith('http://')) cleaned = cleaned.slice(7);

  // Strip path or port if present
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx !== -1) cleaned = cleaned.slice(0, slashIdx);

  const colonIdx = cleaned.indexOf(':');
  if (colonIdx !== -1) cleaned = cleaned.slice(0, colonIdx);

  // Extract domain from email
  const atIdx = cleaned.lastIndexOf('@');
  if (atIdx !== -1) {
    cleaned = cleaned.slice(atIdx + 1);
  }

  // Remove leading dot or trailing dot
  cleaned = cleaned.replace(/^\.+|\.+$/g, '');

  return cleaned;
}

/**
 * Validates whether a domain is an enterprise corporate domain.
 * Must match FQDN rules and not belong to a public consumer email provider.
 */
export function isCorporateEmailDomain(domainOrEmail: string): boolean {
  const domain = normalizeCorporateDomain(domainOrEmail);
  if (!domain || domain.length < 4 || domain.length > 253) {
    return false;
  }

  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return false;
  }

  if (!DOMAIN_REGEX.test(domain)) {
    return false;
  }

  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) {
    return false;
  }

  return true;
}
