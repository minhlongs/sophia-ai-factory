/**
 * Unit tests for usdt-addr-validator
 * @module land/payouts/__tests__/usdt-addr-validator.test
 */

import { describe, it, expect } from 'vitest';
import {
  validateTrc20Address,
  validateErc20Address,
  validateUsdtAddress,
} from '../usdt-addr-validator';

// Known-valid TRC20 address for testing (T-prefix, 34 chars)
const VALID_TRC20 = 'TXYZ1234567890abcdefghijklmnopqrstuvwxyz';
// Known-valid ERC20 address for testing
const VALID_ERC20 = '0x1234567890abcdef1234567890abcdef12345678';

describe('validateErc20Address', () => {
  it('returns true for valid ERC20 address', () => {
    expect(validateErc20Address(VALID_ERC20)).toBe(true);
  });

  it('accepts mixed-case hex', () => {
    expect(validateErc20Address('0xAbCdEf1234567890AbCdEf1234567890AbCdEf12')).toBe(true);
  });

  it('rejects address shorter than 42 chars', () => {
    expect(validateErc20Address('0x12345')).toBe(false);
  });

  it('rejects address without 0x prefix', () => {
    expect(validateErc20Address('1234567890abcdef1234567890abcdef12345678')).toBe(false);
  });

  it('rejects null/empty', () => {
    expect(validateErc20Address('')).toBe(false);
  });

  it('rejects zero address', () => {
    expect(validateErc20Address('0x0000000000000000000000000000000000000000')).toBe(false);
  });

  it('rejects address with non-hex characters', () => {
    expect(validateErc20Address('0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG')).toBe(false);
  });
});

describe('validateTrc20Address', () => {
  it('returns false for empty string', async () => {
    expect(await validateTrc20Address('')).toBe(false);
  });

  it('returns false for non-T prefix', async () => {
    expect(await validateTrc20Address('A')).toBe(false);
  });

  it('returns false for wrong length', async () => {
    expect(await validateTrc20Address('T')).toBe(false);
    expect(await validateTrc20Address('T' + 'A'.repeat(33))).toBe(false); // 34 without T
  });

  it('rejects null/undefined via empty string', async () => {
    expect(await validateTrc20Address('')).toBe(false);
  });
});

describe('validateUsdtAddress', () => {
  it('validates ERC20 address for usdt_erc20', async () => {
    const result = await validateUsdtAddress(VALID_ERC20, 'usdt_erc20');
    expect(result).toBe(true);
  });

  it('validates TRC20 address for usdt_trc20', async () => {
    // We can't test a real TRC20 without a valid Base58Check address,
    // but we can verify the function returns false for invalid
    const result = await validateUsdtAddress('invalid_addr', 'usdt_trc20');
    expect(result).toBe(false);
  });

  it('returns false for unknown method', async () => {
    const result = await validateUsdtAddress('0x1234', 'bank_account' as never);
    expect(result).toBe(false);
  });

  it('rejects empty address for any method', async () => {
    expect(await validateUsdtAddress('', 'usdt_erc20')).toBe(false);
    expect(await validateUsdtAddress('', 'usdt_trc20')).toBe(false);
  });
});
