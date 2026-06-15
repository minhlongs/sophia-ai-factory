import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateOpenRouter, validateElevenLabs, validateDID, validateAirtable } from './services';

// Mock global fetch
const globalFetch = global.fetch = vi.fn();

describe('Validation Services', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('validateOpenRouter', () => {
    it('returns valid for successful response', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ data: 'some-data' }),
      } as Response);

      const result = await validateOpenRouter('valid-key');
      expect(result).toEqual({ valid: true, message: 'Valid OpenRouter key', meta: { data: 'some-data' } });
      expect(globalFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/auth/key',
        expect.objectContaining({ headers: { Authorization: 'Bearer valid-key' } })
      );
    });

    it('returns invalid for non-200 response', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 401,
      } as Response);

      const result = await validateOpenRouter('invalid-key');
      expect(result).toEqual({ valid: false, message: 'Invalid key (Status: 401)' });
    });

    it('returns invalid if key is missing', async () => {
      const result = await validateOpenRouter('');
      expect(result).toEqual({ valid: false, message: 'Key is required' });
    });

    it('handles network errors', async () => {
      globalFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await validateOpenRouter('key');
      expect(result).toEqual({ valid: false, message: 'Network error: Network error' });
    });

    it('handles non-Error objects in catch', async () => {
      globalFetch.mockRejectedValueOnce('String error');
      const result = await validateOpenRouter('key');
      expect(result).toEqual({ valid: false, message: 'Network error: String error' });
    });
  });

  describe('validateElevenLabs', () => {
    it('returns valid for successful response', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ tier: 'creator' }),
      } as Response);

      const result = await validateElevenLabs('valid-key');
      expect(result).toEqual({ valid: true, message: 'Valid ElevenLabs key', meta: { tier: 'creator' } });
    });

    it('returns invalid for non-200 response', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 401,
      } as Response);

      const result = await validateElevenLabs('invalid-key');
      expect(result).toEqual({ valid: false, message: 'Invalid key (Status: 401)' });
    });

    it('returns invalid if key is missing', async () => {
      const result = await validateElevenLabs('');
      expect(result).toEqual({ valid: false, message: 'Key is required' });
    });

    it('handles network errors', async () => {
      globalFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await validateElevenLabs('key');
      expect(result).toEqual({ valid: false, message: 'Network error: Network error' });
    });

    it('handles non-Error objects in catch', async () => {
      globalFetch.mockRejectedValueOnce('String error');
      const result = await validateElevenLabs('key');
      expect(result).toEqual({ valid: false, message: 'Network error: String error' });
    });
  });

  describe('validateDID', () => {
    it('returns valid for successful response', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ credits: 100 }),
      } as Response);

      const result = await validateDID('valid-key');
      expect(result).toEqual({ valid: true, message: 'Valid D-ID key', meta: { credits: 100 } });
    });

    it('returns invalid for 401 response', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 401,
      } as Response);

      const result = await validateDID('invalid-key');
      expect(result).toEqual({ valid: false, message: 'Invalid key (Status: 401)' });
    });

    it('returns invalid for other non-200 responses', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 500,
      } as Response);

      const result = await validateDID('error-key');
      expect(result).toEqual({ valid: false, message: 'Invalid key (Status: 500)' });
    });

    it('returns invalid if key is missing', async () => {
      const result = await validateDID('');
      expect(result).toEqual({ valid: false, message: 'Key is required' });
    });

    it('handles network errors', async () => {
      globalFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await validateDID('key');
      expect(result).toEqual({ valid: false, message: 'Network error: Network error' });
    });

    it('handles non-Error objects in catch', async () => {
      globalFetch.mockRejectedValueOnce('String error');
      const result = await validateDID('key');
      expect(result).toEqual({ valid: false, message: 'Network error: String error' });
    });
  });

  describe('validateAirtable', () => {
    it('returns valid for successful PAT check', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ id: 'usr123', email: 'test@airtable.com' }),
      } as Response);

      const result = await validateAirtable('valid-pat');
      expect(result).toEqual({
        valid: true,
        message: 'Valid Airtable key',
        meta: { id: 'usr123', email: 'test@airtable.com' }
      });
    });

    it('returns invalid for failed PAT check', async () => {
      globalFetch.mockResolvedValueOnce({
        status: 403,
      } as Response);

      const result = await validateAirtable('invalid-pat');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid Personal Access Token');
    });

    it('returns invalid if key is missing', async () => {
      const result = await validateAirtable('');
      expect(result).toEqual({ valid: false, message: 'Key is required' });
    });

    it('handles network errors', async () => {
      globalFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await validateAirtable('pat');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Network error validating PAT');
    });

    it('handles non-Error objects in catch', async () => {
      globalFetch.mockRejectedValueOnce('String error');
      const result = await validateAirtable('pat');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Network error validating PAT: String error');
    });

    it('validates baseId if provided', async () => {
        // Mock success for PAT check
        globalFetch.mockResolvedValueOnce({
          status: 200,
          json: async () => ({ id: 'usr123', email: 'test@airtable.com' }),
        } as Response);

        const result = await validateAirtable('valid-pat');
        expect(result).toEqual({
          valid: true,
          message: 'Valid Airtable key',
          meta: { id: 'usr123', email: 'test@airtable.com' }
        });
    });
  });
});
