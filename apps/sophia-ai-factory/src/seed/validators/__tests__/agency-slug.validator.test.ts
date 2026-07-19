import { describe, it, expect } from 'vitest'
import { validateAgencySlug, AGENCY_SLUG_REGEX } from '../agency-slug.validator'

describe('Agency Slug Validator', () => {
  describe('valid slugs', () => {
    it('accepts simple lowercase alphanumeric', () => {
      const result = validateAgencySlug('acme');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('acme');
    });

    it('accepts slug with single hyphen', () => {
      const result = validateAgencySlug('acme-corp');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('acme-corp');
    });

    it('accepts slug with multiple hyphens', () => {
      const result = validateAgencySlug('my-awesome-agency');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value).toBe('my-awesome-agency');
    });

    it('accepts minimum length (3 chars)', () => {
      const result = validateAgencySlug('abc');
      expect(result.ok).toBe(true);
    });

    it('accepts maximum length (50 chars)', () => {
      const slug = 'a'.repeat(50);
      const result = validateAgencySlug(slug);
      expect(result.ok).toBe(true);
    });
  });

  describe('invalid slugs', () => {
    it('rejects uppercase letters', () => {
      const result = validateAgencySlug('Acme');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_SLUG_FORMAT');
    });

    it('rejects spaces', () => {
      const result = validateAgencySlug('acme corp');
      expect(result.ok).toBe(false);
    });

    it('rejects underscores', () => {
      const result = validateAgencySlug('acme_corp');
      expect(result.ok).toBe(false);
    });

    it('rejects too short (2 chars)', () => {
      const result = validateAgencySlug('ab');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_SLUG_FORMAT');
    });

    it('rejects exceeding max length (51 chars)', () => {
      const slug = 'a'.repeat(51);
      const result = validateAgencySlug(slug);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('INVALID_SLUG_FORMAT');
    });

    it('rejects empty string', () => {
      const result = validateAgencySlug('');
      expect(result.ok).toBe(false);
    });

    it('rejects slug starting with hyphen', () => {
      const result = validateAgencySlug('-acme');
      expect(result.ok).toBe(false);
    });

    it('rejects slug ending with hyphen', () => {
      const result = validateAgencySlug('acme-');
      expect(result.ok).toBe(false);
    });

    it('rejects slug with consecutive hyphens', () => {
      const result = validateAgencySlug('acme--corp');
      expect(result.ok).toBe(false);
    });

    it('rejects reserved slug "www"', () => {
      const result = validateAgencySlug('www');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('RESERVED_SLUG');
    });

    it('rejects reserved slug "api"', () => {
      const result = validateAgencySlug('api');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('RESERVED_SLUG');
    });

    it('rejects reserved slug "admin"', () => {
      const result = validateAgencySlug('admin');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('RESERVED_SLUG');
    });

    it('rejects reserved slug "dashboard"', () => {
      const result = validateAgencySlug('dashboard');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('RESERVED_SLUG');
    });
  });

  describe('AGENCY_SLUG_REGEX', () => {
    it('matches valid slugs', () => {
      expect(AGENCY_SLUG_REGEX.test('acme')).toBe(true);
      expect(AGENCY_SLUG_REGEX.test('acme-corp')).toBe(true);
      expect(AGENCY_SLUG_REGEX.test('a-b-c-d')).toBe(true);
    });

    it('does not match invalid slugs', () => {
      expect(AGENCY_SLUG_REGEX.test('Acme')).toBe(false);
      expect(AGENCY_SLUG_REGEX.test('-acme')).toBe(false);
      expect(AGENCY_SLUG_REGEX.test('acme-')).toBe(false);
      expect(AGENCY_SLUG_REGEX.test('acme--corp')).toBe(false);
    });
  });
});
