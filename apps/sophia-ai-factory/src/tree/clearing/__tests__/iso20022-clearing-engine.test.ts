import { describe, it, expect } from 'vitest';
import {
  generatePacs009Xml,
  generatePacs004Xml,
  parseAndValidateIso20022Xml,
  computeIso20022Digest,
} from '../iso20022-clearing-engine';

describe('ISO 20022 Clearing Engine Unit Tests', () => {
  const samplePacs009 = {
    endToEndId: 'E2E-2026-FED-9988',
    uetr: 'e81a364b-74bf-4272-a164-8397a61dcf31',
    instructingBic: 'FRNYUS33XXX',
    instructedBic: 'MASGSG22XXX',
    amountCents: 2500000000, // $25,000,000.00
    currency: 'USD',
    settlementDate: '2026-09-27',
  };

  it('generates valid pacs.009.001.10 XML schema structure', () => {
    const xml = generatePacs009Xml(samplePacs009);
    expect(xml).toContain('pacs.009.001.10');
    expect(xml).toContain('<EndToEndId>E2E-2026-FED-9988</EndToEndId>');
    expect(xml).toContain('<UETR>e81a364b-74bf-4272-a164-8397a61dcf31</UETR>');
    expect(xml).toContain('<IntrBkSttlmAmt Ccy="USD">25000000.00</IntrBkSttlmAmt>');
    expect(xml).toContain('<BICFI>FRNYUS33XXX</BICFI>');
    expect(xml).toContain('<BICFI>MASGSG22XXX</BICFI>');
  });

  it('parses and validates a valid pacs.009 XML document', () => {
    const xml = generatePacs009Xml(samplePacs009);
    const parsed = parseAndValidateIso20022Xml(xml);

    expect(parsed.isValid).toBe(true);
    expect(parsed.messageType).toBe('pacs.009.001.10');
    expect(parsed.endToEndId).toBe(samplePacs009.endToEndId);
    expect(parsed.uetr).toBe(samplePacs009.uetr);
    expect(parsed.amountCents).toBe(samplePacs009.amountCents);
    expect(parsed.currency).toBe('USD');
    expect(parsed.instructingBic).toBe(samplePacs009.instructingBic);
    expect(parsed.instructedBic).toBe(samplePacs009.instructedBic);
  });

  it('generates and validates pacs.004 payment return XML', () => {
    const returnXml = generatePacs004Xml({
      originalEndToEndId: 'E2E-ORIG-1234',
      originalUetr: 'uetr-orig-5678',
      returnReasonCode: 'AC04', // Closed account
      amountCents: 5000000,
      currency: 'USD',
      instructingBic: 'MASGSG22XXX',
      instructedBic: 'FRNYUS33XXX',
    });

    expect(returnXml).toContain('pacs.004.001.11');
    expect(returnXml).toContain('<Cd>AC04</Cd>');

    const parsed = parseAndValidateIso20022Xml(returnXml);
    expect(parsed.isValid).toBe(true);
    expect(parsed.messageType).toBe('pacs.004.001.11');
    expect(parsed.endToEndId).toBe('E2E-ORIG-1234');
    expect(parsed.amountCents).toBe(5000000);
  });

  it('rejects malformed XML gracefully', () => {
    const invalidXml = 'Not valid XML content';
    const parsed = parseAndValidateIso20022Xml(invalidXml);
    expect(parsed.isValid).toBe(false);
    expect(parsed.error).toBeDefined();
  });

  it('computes deterministic signature digest for audit verification', () => {
    const xml = generatePacs009Xml(samplePacs009);
    const digest1 = computeIso20022Digest(xml);
    const digest2 = computeIso20022Digest(xml);

    expect(digest1).toBe(digest2);
    expect(digest1.startsWith('iso_sig_')).toBe(true);
  });
});
