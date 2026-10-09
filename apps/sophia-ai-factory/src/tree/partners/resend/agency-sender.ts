/**
 * Agency Outbound Email Sender Formatter & Sanitizer
 *
 * @module tree/partners/resend/agency-sender
 */

import type { AgencyEmailSenderConfig } from './types';

/**
 * Formats a clean agency outbound sender string (e.g. "Apex Media <marketing@apexmedia.com>").
 * Prevents email header injection and eliminates all vendor references.
 */
export function getAgencyEmailSender(config: AgencyEmailSenderConfig): string {
  let extractedName: string | undefined;
  let rawEmail = '';

  if (config.customEmailSender && typeof config.customEmailSender === 'string') {
    const trimmed = config.customEmailSender.trim();
    const angleMatch = trimmed.match(/^([^<]+)<([^>]+)>/);
    if (angleMatch) {
      extractedName = angleMatch[1].trim();
      rawEmail = angleMatch[2].trim();
    } else {
      const bareAngle = trimmed.match(/<([^>]+)>/);
      if (bareAngle) {
        rawEmail = bareAngle[1].trim();
      } else {
        rawEmail = trimmed;
      }
    }
  } else if (config.senderEmail && typeof config.senderEmail === 'string') {
    rawEmail = config.senderEmail.trim();
  } else if (config.customDomain || config.domainName) {
    const domain = (config.customDomain || config.domainName || '')
      .trim()
      .toLowerCase();
    rawEmail = `marketing@${domain}`;
  } else {
    rawEmail = 'marketing@agencybrand.com';
  }

  // 1. Resolve sender display name
  let rawName =
    config.senderName ||
    config.brandName ||
    config.agencyName ||
    extractedName ||
    'Agency Partner';

  // If name or email contains CRLF newlines, discard everything after the newline (header injection defense)
  if (rawName.includes('\r') || rawName.includes('\n')) {
    rawName = rawName.split(/[\r\n]/)[0].trim();
  }

  if (rawEmail.includes('\r') || rawEmail.includes('\n')) {
    rawEmail = rawEmail.split(/[\r\n]/)[0].trim();
  }

  // Sanitize name: remove SMTP header keywords, carriage returns, newlines, null bytes, quotes, angle brackets
  const cleanName = rawName
    .replace(/(?:bcc|cc|to|subject)\s*:/gi, '')
    .replace(/[\r\n\0"<>;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Agency Partner';

  // Sanitize email: remove spaces, control characters, quotes, angle brackets, and SMTP header keywords
  let cleanEmail = rawEmail
    .replace(/(?:bcc|cc|to|subject)\s*:/gi, '')
    .replace(/[\s\r\n\0"<>;]/g, '')
    .toLowerCase();

  // If email was subjected to injection with appended text, keep the first valid email part
  const emailMatch = cleanEmail.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    cleanEmail = emailMatch[0];
  }

  return `${cleanName} <${cleanEmail}>`;
}
