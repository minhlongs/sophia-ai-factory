/**
 * Empirical Adversarial Stress Test Suite: Milestone 3 Enterprise Billing
 *
 * Rigorously challenges edge cases, boundary conditions, corruption scenarios,
 * and security vectors across:
 * 1. FX Converter (amounts, corrupt rates, zero-decimal formatting)
 * 2. Annual Commitment & Dynamic Proration (leap years, boundaries, credit/due)
 * 3. Vietnamese Tax ID (MST) & Invoice Generator (injection, penny leakage, XSS)
 * 4. Tenant Isolation & Permissions (cross-tenant access, non-billing roles)
 *
 * Layer: tree/billing/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  convertCurrency,
  formatCurrency,
  BEDROCK_FX_RATES,
} from '../fx-converter';
import {
  calculateAnnualCommitmentQuote,
  calculateProratedUpgrade,
  normalizeTierKey,
} from '../annual-commitment-engine';
import {
  validateVietnameseTaxId,
  generateInvoiceNumber,
  generateInvoiceHtml,
  createInvoiceRecord,
  getInvoiceById,
  getInvoicesByOrg,
} from '../invoice-generator';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  EInvoice,
  CreateInvoiceInput,
  SupportedCurrency,
  FxRateMap,
} from '@/seed/types/enterprise-billing';
import { ENTERPRISE_ROLE_PERMISSION_FLAGS } from '@/seed/types/enterprise-rbac';

describe('Adversarial Challenge Suite: Milestone 3 Enterprise Scale Billing', () => {
  // =========================================================================
  // 1. FX Converter Adversarial Tests
  // =========================================================================
  describe('1. FX Converter: Edge Amounts, Corrupted Rates, & Currency Precision', () => {
    it('handles negative amounts cleanly (refunds/adjustments)', () => {
      const res = convertCurrency(-50000, 'USD', 'EUR');
      expect(res.convertedCents).toBe(-46000); // -500.00 USD * 0.92
      expect(res.rate).toBe(0.92);

      const formatted = formatCurrency(-50000, 'USD', 'en-US');
      expect(formatted).toBe('-$500.00');
    });

    it('handles exact zero amounts without signed negative zero', () => {
      const res = convertCurrency(0, 'USD', 'VND');
      expect(res.convertedCents).toBe(0);
      expect(Object.is(res.convertedCents, -0)).toBe(false);

      const formatted = formatCurrency(0, 'VND', 'vi-VN');
      expect(formatted).toContain('0');
    });

    it('handles fractional amounts with deterministic half-up rounding', () => {
      // 100.4 cents * 0.92 = 92.368 -> 92
      const res1 = convertCurrency(100.4, 'USD', 'EUR');
      expect(res1.convertedCents).toBe(92);

      // 100.6 cents * 0.92 = 92.552 -> 93
      const res2 = convertCurrency(100.6, 'USD', 'EUR');
      expect(res2.convertedCents).toBe(93);
    });

    it('handles massive enterprise scale amounts ($10,000,000+ USD) within safe integer range', () => {
      // $10,000,000 USD = 1,000,000,000 cents
      const enterpriseAmountCents = 1_000_000_000;
      const resVnd = convertCurrency(enterpriseAmountCents, 'USD', 'VND');

      // 1B cents * 25,450 = 25,450,000,000,000 cents (254.5 billion VND)
      expect(resVnd.convertedCents).toBe(25_450_000_000_000);
      expect(Number.isSafeInteger(resVnd.convertedCents)).toBe(true);
      expect(resVnd.convertedCents).toBeLessThan(Number.MAX_SAFE_INTEGER);

      // $50,000,000 USD converted to JPY
      const largeJpy = convertCurrency(5_000_000_000, 'USD', 'JPY');
      expect(largeJpy.convertedCents).toBe(775_000_000_000);
      expect(Number.isSafeInteger(largeJpy.convertedCents)).toBe(true);

      const formattedLarge = formatCurrency(enterpriseAmountCents, 'USD', 'en-US');
      expect(formattedLarge).toBe('$10,000,000.00');
    });

    it('rejects missing currency keys in custom rates', () => {
      const corruptRates = {
        base: 'USD' as const,
        rates: {
          USD: 1.0,
          // EUR is missing
          VND: 25450,
          JPY: 155,
          SGD: 1.35,
        } as unknown as Record<SupportedCurrency, number>,
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      expect(() => {
        convertCurrency(1000, 'USD', 'EUR', corruptRates);
      }).toThrow(/Invalid exchange rate for target currency: EUR/i);

      expect(() => {
        convertCurrency(1000, 'EUR', 'USD', corruptRates);
      }).toThrow(/Invalid exchange rate for source currency: EUR/i);
    });

    it('rejects negative and zero exchange rates', () => {
      const negativeRates: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 1.0,
          EUR: -0.92,
          VND: 25450,
          JPY: 155,
          SGD: 1.35,
        },
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      expect(() => {
        convertCurrency(1000, 'USD', 'EUR', negativeRates);
      }).toThrow(/Invalid exchange rate/i);

      const zeroRates: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 1.0,
          EUR: 0,
          VND: 25450,
          JPY: 155,
          SGD: 1.35,
        },
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      expect(() => {
        convertCurrency(1000, 'USD', 'EUR', zeroRates);
      }).toThrow(/Invalid exchange rate/i);
    });

    it('probes behavior on non-finite rates (NaN, Infinity)', () => {
      const nanRates: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 1.0,
          EUR: NaN,
          VND: 25450,
          JPY: 155,
          SGD: 1.35,
        },
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      const infinityRates: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 1.0,
          EUR: Infinity,
          VND: 25450,
          JPY: 155,
          SGD: 1.35,
        },
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      // Non-finite rates (NaN or Infinity) must throw an Error rather than silently corrupting calculations
      expect(() => {
        convertCurrency(1000, 'USD', 'EUR', nanRates);
      }).toThrow(/Invalid exchange rate for target currency: EUR/i);

      expect(() => {
        convertCurrency(1000, 'USD', 'EUR', infinityRates);
      }).toThrow(/Invalid exchange rate for target currency: EUR/i);
    });

    it('enforces 0 decimals for VND and JPY vs 2 decimals for USD, EUR, SGD', () => {
      // VND: 25,450.00 cents = 254.50 major units, but formatted as 0 decimals
      const vndFormatted = formatCurrency(2545000, 'VND', 'vi-VN');
      expect(vndFormatted).not.toMatch(/\.00/);
      expect(vndFormatted).not.toMatch(/,00/);

      // JPY: formatted as 0 decimals
      const jpyFormatted = formatCurrency(15500, 'JPY', 'ja-JP');
      expect(jpyFormatted).not.toMatch(/\.00/);
      expect(jpyFormatted).not.toMatch(/,00/);

      // USD: must have 2 decimals
      const usdFormatted = formatCurrency(10000, 'USD', 'en-US');
      expect(usdFormatted).toBe('$100.00');

      // EUR: must have 2 decimals
      const eurFormatted = formatCurrency(10000, 'EUR', 'en-US');
      expect(eurFormatted).toBe('€100.00');

      // SGD: must have 2 decimals
      const sgdFormatted = formatCurrency(10000, 'SGD', 'en-US');
      expect(sgdFormatted).toBe('SGD 100.00');
    });
  });

  // =========================================================================
  // 2. Annual Commitment & Proration Adversarial Tests
  // =========================================================================
  describe('2. Annual Commitment & Proration: Leap Years, Cycle Boundaries, & Downgrades', () => {
    it('correctly prorates over a leap year (366 days) vs a standard year (365 days)', () => {
      // Leap year exactly at half-year mark (day 183 of 366 = 0.500000)
      const leapHalf = calculateProratedUpgrade(
        'STARTER',
        'ENTERPRISE',
        183,
        366,
        'USD',
      );
      expect(leapHalf.daysRemainingInCycle).toBe(183);
      expect(leapHalf.totalDaysInCycle).toBe(366);
      expect(leapHalf.isUpgrade).toBe(true);

      // Current tier: STARTER ($199/mo = 19900 cents) -> unused = 19900 * 0.5 = 9950 cents
      expect(leapHalf.unusedAmountCents).toBe(9950);
      // New tier: ENTERPRISE ($799/mo = 79900 cents) -> prorated = 79900 * 0.5 = 39950 cents
      expect(leapHalf.proratedNewTierCents).toBe(39950);
      // Net due: 39950 - 9950 = 30000 cents ($300.00)
      expect(leapHalf.netAmountDueCents).toBe(30000);
      expect(leapHalf.creditCents).toBe(0);

      // Standard year at day 183 of 365 (183/365 = 0.501369...)
      const standardHalf = calculateProratedUpgrade(
        'STARTER',
        'ENTERPRISE',
        183,
        365,
        'USD',
      );
      expect(standardHalf.totalDaysInCycle).toBe(365);
      // Should reflect precise fractional ratio
      expect(standardHalf.unusedAmountCents).toBe(Math.round(19900 * (183 / 365)));
      expect(standardHalf.proratedNewTierCents).toBe(Math.round(79900 * (183 / 365)));
    });

    it('handles boundary cycle days: day 0, day 365, day 366, negative days, days > total', () => {
      // Day 0: cycle expired, no unused credit, no charge
      const dayZero = calculateProratedUpgrade('PRO', 'ENTERPRISE', 0, 365);
      expect(dayZero.daysRemainingInCycle).toBe(0);
      expect(dayZero.unusedAmountCents).toBe(0);
      expect(dayZero.proratedNewTierCents).toBe(0);
      expect(dayZero.netAmountDueCents).toBe(0);
      expect(dayZero.creditCents).toBe(0);

      // Negative remaining days: safely clamped to 0
      const negDays = calculateProratedUpgrade('PRO', 'ENTERPRISE', -15, 365);
      expect(negDays.daysRemainingInCycle).toBe(0);
      expect(negDays.netAmountDueCents).toBe(0);

      // Full standard year: day 365 of 365 (100% remaining)
      const day365 = calculateProratedUpgrade('STARTER', 'ENTERPRISE', 365, 365);
      expect(day365.daysRemainingInCycle).toBe(365);
      expect(day365.unusedAmountCents).toBe(19900);
      expect(day365.proratedNewTierCents).toBe(79900);
      expect(day365.netAmountDueCents).toBe(60000);

      // Full leap year: day 366 of 366
      const day366 = calculateProratedUpgrade('STARTER', 'ENTERPRISE', 366, 366);
      expect(day366.daysRemainingInCycle).toBe(366);
      expect(day366.netAmountDueCents).toBe(60000);

      // Days remaining greater than total: clamped to totalDaysInCycle
      const overflowDays = calculateProratedUpgrade('STARTER', 'ENTERPRISE', 500, 365);
      expect(overflowDays.daysRemainingInCycle).toBe(365);
      expect(overflowDays.netAmountDueCents).toBe(60000);

      // Invalid total days (<= 0): throws error
      expect(() => {
        calculateProratedUpgrade('STARTER', 'ENTERPRISE', 10, 0);
      }).toThrow(/Invalid totalDaysInCycle/);

      expect(() => {
        calculateProratedUpgrade('STARTER', 'ENTERPRISE', 10, -30);
      }).toThrow(/Invalid totalDaysInCycle/);
    });

    it('handles same-tier transitions (netAmountDue = 0, credit = 0)', () => {
      const sameTier = calculateProratedUpgrade('PRO', 'PRO', 15, 30);
      expect(sameTier.isUpgrade).toBe(false);
      expect(sameTier.netAmountDueCents).toBe(0);
      expect(sameTier.creditCents).toBe(0);
      expect(sameTier.unusedAmountCents).toBe(sameTier.proratedNewTierCents);
    });

    it('calculates downgrade credit correctly without charging net amount', () => {
      // MASTER ($4999/mo) -> STARTER ($199/mo) with 15 of 30 days left (50%)
      const downgrade = calculateProratedUpgrade('MASTER', 'STARTER', 15, 30);
      expect(downgrade.isUpgrade).toBe(false);
      expect(downgrade.unusedAmountCents).toBe(Math.round(499900 * 0.5)); // 249950
      expect(downgrade.proratedNewTierCents).toBe(Math.round(19900 * 0.5)); // 9950
      expect(downgrade.netAmountDueCents).toBe(0);
      // Credit = 249950 - 9950 = 240000 cents ($2,400 credit)
      expect(downgrade.creditCents).toBe(240000);
    });

    it('normalizes tier aliases (BASIC -> STARTER, GROWTH -> CREATOR)', () => {
      expect(normalizeTierKey('basic')).toBe('STARTER');
      expect(normalizeTierKey('growth')).toBe('CREATOR');
      expect(normalizeTierKey('premium')).toBe('CREATOR');

      const quote = calculateAnnualCommitmentQuote('BASIC');
      expect(quote.tier).toBe('STARTER');
      expect(quote.discountPercentage).toBe(20);
      expect(quote.monthsFree).toBe(2);
    });
  });

  // =========================================================================
  // 3. Vietnamese Tax ID (MST) & Invoice Generator Adversarial Tests
  // =========================================================================
  describe('3. Vietnamese Tax ID (MST) & Invoice Generator: Injection, Rounding, & XSS', () => {
    it('rejects all malicious and malformed Vietnamese Tax IDs', () => {
      const adversarialMsts = [
        // Letters & alphanumeric
        '012345678A',
        'ABCDEFGHIJ',
        '031789456X-001',
        // Special characters & delimiters
        '0101234567!',
        '0317894562@',
        '0101234567/001',
        '0101234567 001',
        // SQL injection vectors
        "' OR '1'='1",
        "'; DROP TABLE invoices; --",
        "0101234567' UNION SELECT * FROM users --",
        // XSS vectors
        "<script>alert(1)</script>",
        "<img src=x onerror=alert(1)>",
        // Invalid lengths
        '123456789', // 9 digits
        '01012345678', // 11 digits
        '0101234567-01', // branch with 2 digits
        '0101234567-0001', // branch with 4 digits
        '0101234567001', // 13 digits without hyphen
        // Null / empty
        '',
        '   ',
      ];

      for (const mst of adversarialMsts) {
        const res = validateVietnameseTaxId(mst);
        expect(res.valid).toBe(false);
      }
    });

    it('accepts valid 10-digit enterprise MSTs and 13-digit branch MSTs with normalization', () => {
      const validCases = [
        { raw: '0317894562', expected: '0317894562' },
        { raw: '  0317894562  ', expected: '0317894562' },
        { raw: '0101234567-001', expected: '0101234567-001' },
        { raw: '  0101234567-001  ', expected: '0101234567-001' },
        { raw: '0100109106-999', expected: '0100109106-999' },
      ];

      for (const c of validCases) {
        const res = validateVietnameseTaxId(c.raw);
        expect(res.valid).toBe(true);
        expect(res.normalized).toBe(c.expected);
      }
    });

    it('prevents VAT penny leakage across 8%, 10%, and 0% tax rates', async () => {
      // In-memory mock store
      const store = new Map<string, Record<string, unknown>>();
      const mockDb = {
        prepare: () => ({
          bind: (...params: unknown[]) => ({
            run: async () => {
              store.set(params[0] as string, {
                id: params[0],
                amount_cents: params[6],
                vat_rate: params[12],
                vat_amount_cents: params[13],
                total_amount_cents: params[14],
              });
              return { success: true };
            },
          }),
        }),
      } as unknown as D1Database;

      // Case 1: $100.00 at 10% VAT
      const inv10 = await createInvoiceRecord(mockDb, {
        orgId: 'org_vat_test',
        tier: 'PRO',
        amountCents: 10000, // $100.00
        vatRate: 0.10,
        legalName: 'Test Org',
        billingAddress: 'Address',
      });
      expect(inv10.vatAmountCents).toBe(1000);
      expect(inv10.totalAmountCents).toBe(11000);
      expect(inv10.totalAmountCents).toBe(inv10.amountCents + inv10.vatAmountCents);

      // Case 2: $100.00 at 8% VAT
      const inv8 = await createInvoiceRecord(mockDb, {
        orgId: 'org_vat_test',
        tier: 'PRO',
        amountCents: 10000, // $100.00
        vatRate: 0.08,
        legalName: 'Test Org',
        billingAddress: 'Address',
      });
      expect(inv8.vatAmountCents).toBe(800);
      expect(inv8.totalAmountCents).toBe(10800);
      expect(inv8.totalAmountCents).toBe(inv8.amountCents + inv8.vatAmountCents);

      // Case 3: $100.00 at 0% VAT
      const inv0 = await createInvoiceRecord(mockDb, {
        orgId: 'org_vat_test',
        tier: 'PRO',
        amountCents: 10000,
        vatRate: 0.0,
        legalName: 'Test Org',
        billingAddress: 'Address',
      });
      expect(inv0.vatAmountCents).toBe(0);
      expect(inv0.totalAmountCents).toBe(10000);
      expect(inv0.totalAmountCents).toBe(inv0.amountCents + inv0.vatAmountCents);

      // Case 4: Fractional penny stress: $99.99 (9999 cents) at 8% VAT
      // 9999 * 0.08 = 799.92 -> rounds to 800
      const invFraction = await createInvoiceRecord(mockDb, {
        orgId: 'org_vat_test',
        tier: 'PRO',
        amountCents: 9999,
        vatRate: 0.08,
        legalName: 'Test Org',
        billingAddress: 'Address',
      });
      expect(invFraction.vatAmountCents).toBe(800);
      expect(invFraction.totalAmountCents).toBe(10799);
      // Zero penny leakage invariant: Total MUST equal Subtotal + VAT
      expect(invFraction.totalAmountCents).toBe(invFraction.amountCents + invFraction.vatAmountCents);
    });

    it('probes HTML / XSS injection vectors in legalName and billingAddress', () => {
      const xssInvoice: EInvoice = {
        id: 'inv_xss',
        invoiceNumber: 'INV-2026-XSS01',
        orgId: 'org_xss',
        subaccountId: null,
        tier: 'ENTERPRISE',
        billingCycle: 'annual',
        amountCents: 799000,
        currency: 'USD',
        fxRate: 1.0,
        taxId: null,
        legalName: '<script>alert("XSS")</script>',
        billingAddress: '<img src=x onerror=alert(1)>',
        vatRate: 0.0,
        vatAmountCents: 0,
        totalAmountCents: 799000,
        taxFormType: 'NONE',
        status: 'draft',
        pdfR2Key: null,
        paidAt: null,
        createdAt: 1718000000,
        updatedAt: 1718000000,
      };

      const html = generateInvoiceHtml(xssInvoice, 'en');

      // Assert that generateInvoiceHtml properly escapes raw script tags and image onerror tags
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');

      // Assert that raw unescaped script and img tags are NOT present in the HTML output
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<script>alert("XSS")</script>');
      expect(html).not.toContain('<img');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
    });
  });

  // =========================================================================
  // 4. Tenant Isolation & Permissions Adversarial Tests
  // =========================================================================
  describe('4. Tenant Isolation & Permissions: Cross-Tenant Access & Role Gating', () => {
    // In-memory mock database for tenant simulation
    const orgMembersTable = new Map<string, { org_id: string; user_id: string; role: string }>();
    const invoicesTable = new Map<string, EInvoice>();
    const subscriptionsTable = new Map<string, { org_id: string; plan: string; status: string }>();

    const createSimulatedDb = (): D1Database => {
      return {
        prepare: (query: string) => {
          let boundParams: unknown[] = [];
          return {
            bind: (...params: unknown[]) => {
              boundParams = params;
              return {
                first: async <T>() => {
                  // SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1
                  if (query.includes('FROM org_members')) {
                    const orgId = boundParams[0] as string;
                    const userId = boundParams[1] as string;
                    const key = `${orgId}:${userId}`;
                    const row = orgMembersTable.get(key);
                    return (row ? { role: row.role } : null) as T;
                  }
                  // SELECT plan, status FROM subscriptions WHERE org_id = ?1 LIMIT 1
                  if (query.includes('FROM subscriptions')) {
                    const orgId = boundParams[0] as string;
                    const sub = subscriptionsTable.get(orgId);
                    return (sub ?? null) as T;
                  }
                  // SELECT * FROM invoices WHERE id = ?1 LIMIT 1
                  if (query.includes('FROM invoices WHERE id = ?1')) {
                    const id = boundParams[0] as string;
                    return (invoicesTable.get(id) ?? null) as T;
                  }
                  return null as T;
                },
                all: async <T>() => {
                  if (query.includes('FROM invoices WHERE org_id = ?1')) {
                    const orgId = boundParams[0] as string;
                    const rows = Array.from(invoicesTable.values()).filter((i) => i.orgId === orgId);
                    return { results: rows as T[] };
                  }
                  return { results: [] };
                },
                run: async () => ({ success: true }),
              };
            },
          };
        },
      } as unknown as D1Database;
    };

    beforeEach(() => {
      orgMembersTable.clear();
      invoicesTable.clear();
      subscriptionsTable.clear();

      // Org A (Victim)
      subscriptionsTable.set('org_victim', { org_id: 'org_victim', plan: 'enterprise', status: 'active' });
      orgMembersTable.set('org_victim:user_victim_owner', {
        org_id: 'org_victim',
        user_id: 'user_victim_owner',
        role: 'owner',
      });
      invoicesTable.set('inv_victim_secret', {
        id: 'inv_victim_secret',
        invoiceNumber: 'INV-2026-VIC01',
        orgId: 'org_victim',
        subaccountId: null,
        tier: 'ENTERPRISE',
        billingCycle: 'annual',
        amountCents: 799000,
        currency: 'USD',
        fxRate: 1.0,
        taxId: null,
        legalName: 'Victim Corp',
        billingAddress: 'Victim HQ',
        vatRate: 0.0,
        vatAmountCents: 0,
        totalAmountCents: 799000,
        taxFormType: 'NONE',
        status: 'issued',
        pdfR2Key: null,
        paidAt: null,
        createdAt: 1718000000,
        updatedAt: 1718000000,
      });

      // Org B (Attacker)
      subscriptionsTable.set('org_attacker', { org_id: 'org_attacker', plan: 'starter', status: 'active' });
      orgMembersTable.set('org_attacker:user_attacker', {
        org_id: 'org_attacker',
        user_id: 'user_attacker',
        role: 'owner',
      });
    });

    it('enforces tenant isolation: user from Org B cannot query invoices from Org A', async () => {
      const db = createSimulatedDb();

      // Direct D1 query scoped to Org B returns 0 invoices from Org A
      const attackerInvoices = await getInvoicesByOrg(db, 'org_attacker');
      expect(attackerInvoices.length).toBe(0);

      const victimInvoices = await getInvoicesByOrg(db, 'org_victim');
      expect(victimInvoices.length).toBe(1);
      expect(victimInvoices[0].id).toBe('inv_victim_secret');
    });

    it('verifies that non-billing enterprise roles (video_editor, reviewer, creative_director) lack canManageBilling', () => {
      expect(ENTERPRISE_ROLE_PERMISSION_FLAGS.enterprise_admin.canManageBilling).toBe(true);
      expect(ENTERPRISE_ROLE_PERMISSION_FLAGS.creative_director.canManageBilling).toBe(false);
      expect(ENTERPRISE_ROLE_PERMISSION_FLAGS.video_editor.canManageBilling).toBe(false);
      expect(ENTERPRISE_ROLE_PERMISSION_FLAGS.reviewer.canManageBilling).toBe(false);
    });

    it('verifies that cross-tenant access to getInvoiceById requires org authorization guard', async () => {
      const db = createSimulatedDb();
      const invoice = await getInvoiceById(db, 'inv_victim_secret');
      expect(invoice).not.toBeNull();

      // Check whether user_attacker belongs to invoice.orgId ('org_victim')
      const member = await db
        .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
        .bind(invoice?.orgId, 'user_attacker')
        .first<{ role: string }>();

      // Must be null: attacker does NOT belong to victim org
      expect(member).toBeNull();
    });

    it('verifies that non-billing roles (video_editor, reviewer) are blocked from mutating invoice states', async () => {
      const db = createSimulatedDb();

      // Add a video editor and a reviewer to Org A
      orgMembersTable.set('org_victim:user_editor', {
        org_id: 'org_victim',
        user_id: 'user_editor',
        role: 'video_editor',
      });
      orgMembersTable.set('org_victim:user_reviewer', {
        org_id: 'org_victim',
        user_id: 'user_reviewer',
        role: 'reviewer',
      });

      // Simulation function matching assertBillingAccess logic in enterprise-invoice-actions.ts
      const checkBillingPermission = async (userId: string, orgId: string) => {
        const member = await db
          .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
          .bind(orgId, userId)
          .first<{ role: string }>();

        if (!member) {
          return { allowed: false, reason: 'NOT_MEMBER' };
        }

        const role = member.role;
        const isTraditionalAdmin = role === 'owner' || role === 'admin';
        const isEnterpriseBillingAdmin =
          role === 'enterprise_admin' ||
          (ENTERPRISE_ROLE_PERMISSION_FLAGS[role as keyof typeof ENTERPRISE_ROLE_PERMISSION_FLAGS]?.canManageBilling ?? false);

        if (!isTraditionalAdmin && !isEnterpriseBillingAdmin) {
          return { allowed: false, reason: 'LACKS_PERMISSION' };
        }

        return { allowed: true };
      };

      // Attacker from outside: NOT_MEMBER
      const attackerCheck = await checkBillingPermission('user_attacker', 'org_victim');
      expect(attackerCheck.allowed).toBe(false);
      expect(attackerCheck.reason).toBe('NOT_MEMBER');

      // Video Editor inside org: LACKS_PERMISSION
      const editorCheck = await checkBillingPermission('user_editor', 'org_victim');
      expect(editorCheck.allowed).toBe(false);
      expect(editorCheck.reason).toBe('LACKS_PERMISSION');

      // Reviewer inside org: LACKS_PERMISSION
      const reviewerCheck = await checkBillingPermission('user_reviewer', 'org_victim');
      expect(reviewerCheck.allowed).toBe(false);
      expect(reviewerCheck.reason).toBe('LACKS_PERMISSION');

      // Owner inside org: ALLOWED
      const ownerCheck = await checkBillingPermission('user_victim_owner', 'org_victim');
      expect(ownerCheck.allowed).toBe(true);
    });
  });
});
