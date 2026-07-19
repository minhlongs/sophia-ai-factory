import { describe, it, expect } from 'vitest';
import { userProfileFormSchema } from './settings';

describe('Settings Schema Validation', () => {
  it('should validate a valid profile', () => {
    const validData = {
      fullName: 'John Doe',
      email: 'john@example.com',
      settings: {
        theme: 'dark',
        notifications: {
          email: {
            marketing: true,
            security: true,
            updates: false,
          },
          telegram: {
            enabled: true,
          }
        }
      },
      apiKeys: {
        openai: 'sk-123',
        anthropic: '',
        elevenlabs: undefined
      }
    };

    const result = userProfileFormSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should validate with minimal data (defaults)', () => {
    const minimalData = {
      settings: {
        theme: 'system',
      },
      apiKeys: {}
    };

    const result = userProfileFormSchema.safeParse(minimalData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.settings.theme).toBe('system');
    }
  });

  it('should validate email format if provided', () => {
    const invalidEmailData = {
      email: 'not-an-email',
      settings: { theme: 'system' },
      apiKeys: {}
    };
    const result = userProfileFormSchema.safeParse(invalidEmailData);
    expect(result.success).toBe(false);
  });

  it('should allow optional API keys to be empty strings', () => {
    const data = {
      settings: { theme: 'light' },
      apiKeys: {
        openai: '',
        anthropic: '',
        elevenlabs: ''
      }
    };
    const result = userProfileFormSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should fail if fullName is too short', () => {
    const invalidData = {
      fullName: 'A',
      settings: { theme: 'system' },
      apiKeys: {}
    };
    const result = userProfileFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 2 characters');
    }
  });

  it('should fail if theme is invalid', () => {
    const invalidData = {
      settings: { theme: 'blue' }, // Invalid theme
      apiKeys: {}
    };
    const result = userProfileFormSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
