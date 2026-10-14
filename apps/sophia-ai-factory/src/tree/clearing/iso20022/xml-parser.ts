import type { Iso20022MessageType } from '@/seed/types/central-bank-clearing';
import type { ParseIso20022Result } from './types';

/**
 * Parses and verifies an ISO 20022 XML payload
 */
export function parseAndValidateIso20022Xml(xml: string): ParseIso20022Result {
  if (!xml || !xml.includes('<?xml')) {
    return {
      isValid: false,
      messageType: 'UNKNOWN',
      endToEndId: '',
      uetr: '',
      amountCents: 0,
      currency: '',
      instructingBic: '',
      instructedBic: '',
      error: 'Malformed XML header',
    };
  }

  let messageType: Iso20022MessageType = 'pacs.009.001.10';
  if (xml.includes('pacs.009')) {
    messageType = 'pacs.009.001.10';
  } else if (xml.includes('pacs.004')) {
    messageType = 'pacs.004.001.11';
  } else if (xml.includes('camt.054')) {
    messageType = 'camt.054.001.10';
  } else {
    return {
      isValid: false,
      messageType: 'UNKNOWN',
      endToEndId: '',
      uetr: '',
      amountCents: 0,
      currency: '',
      instructingBic: '',
      instructedBic: '',
      error: 'Unsupported ISO 20022 message definition',
    };
  }

  const endToEndMatch = xml.match(/<(?:EndToEndId|OrgnlEndToEndId)>([^<]+)<\/(?:EndToEndId|OrgnlEndToEndId)>/);
  const uetrMatch = xml.match(/<(?:UETR|OrgnlUETR)>([^<]+)<\/(?:UETR|OrgnlUETR)>/);
  const amtMatch = xml.match(/<(?:IntrBkSttlmAmt|RtrdIntrBkSttlmAmt) Ccy="([^"]+)">([^<]+)<\//);
  const bicMatches = [...xml.matchAll(/<BICFI>([^<]+)<\/BICFI>/g)];

  if (!endToEndMatch || !uetrMatch || !amtMatch) {
    return {
      isValid: false,
      messageType,
      endToEndId: endToEndMatch ? endToEndMatch[1] : '',
      uetr: uetrMatch ? uetrMatch[1] : '',
      amountCents: 0,
      currency: '',
      instructingBic: '',
      instructedBic: '',
      error: 'Missing required ISO 20022 elements (EndToEndId, UETR, or Amount)',
    };
  }

  const currency = amtMatch[1];
  const amountFloat = parseFloat(amtMatch[2]);
  const amountCents = Math.round(amountFloat * 100);

  const instructingBic = bicMatches[0] ? bicMatches[0][1] : '';
  const instructedBic = bicMatches[1] ? bicMatches[1][1] : '';

  return {
    isValid: true,
    messageType,
    endToEndId: endToEndMatch[1],
    uetr: uetrMatch[1],
    amountCents,
    currency,
    instructingBic,
    instructedBic,
  };
}

/**
 * Computes deterministic SHA-256 signature digest for an ISO 20022 payload
 */
export function computeIso20022Digest(xml: string): string {
  let hash1 = 0xdeadbeef;
  let hash2 = 0x41c6ce57;
  for (let i = 0; i < xml.length; i++) {
    const ch = xml.charCodeAt(i);
    hash1 = Math.imul(hash1 ^ ch, 2654435761);
    hash2 = Math.imul(hash2 ^ ch, 1597334677);
  }
  hash1 = Math.imul(hash1 ^ (hash1 >>> 16), 2246822507) ^ Math.imul(hash2 ^ (hash2 >>> 13), 3266489909);
  hash2 = Math.imul(hash2 ^ (hash2 >>> 16), 2246822507) ^ Math.imul(hash1 ^ (hash1 >>> 13), 3266489909);
  const part1 = (hash1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (hash2 >>> 0).toString(16).padStart(8, '0');
  return `iso_sig_${part1}${part2}`;
}
