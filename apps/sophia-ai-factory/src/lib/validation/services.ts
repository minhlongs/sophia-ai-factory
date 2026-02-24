import { z } from 'zod';

// Zod schemas for validation
export const apiKeySchema = z.string().min(5, "Key is too short");

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  message?: string;
  meta?: unknown;
}

/**
 * Validate OpenRouter API Key
 * OpenRouter usually requires an "Authorization: Bearer <key>" header
 */
export async function validateOpenRouter(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      // OpenRouter auth/key endpoint returns info about the key
      return { valid: true, message: "Valid OpenRouter key", meta: data };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validate ElevenLabs API Key
 * Endpoint: https://api.elevenlabs.io/v1/user/subscription
 */
export async function validateElevenLabs(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
      method: 'GET',
      headers: {
        'xi-api-key': key
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return { valid: true, message: "Valid ElevenLabs key", meta: { tier: data.tier } };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validate D-ID API Key
 * Uses Basic Auth with the API key against the credits endpoint.
 */
export async function validateDID(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://api.d-id.com/credits', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${key}`
      }
    });

    // If Basic fails, try Bearer (some tiers)
    if (response.status === 401) {
       return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }

    if (response.status === 200) {
      const data = await response.json();
      return { valid: true, message: "Valid D-ID key", meta: data };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Validate Airtable API Key
 * Endpoint: https://api.airtable.com/v0/meta/whoami
 */
export async function validateAirtable(key: string): Promise<ValidationResult> {
  if (!key) return { valid: false, message: "Key is required" };

  try {
    const response = await fetch('https://api.airtable.com/v0/meta/whoami', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.status === 200) {
      const data = await response.json();
      return { valid: true, message: "Valid Airtable key", meta: { id: data.id, email: data.email } };
    } else if (response.status === 403) {
      return { valid: false, message: "Invalid Personal Access Token" };
    } else {
      return { valid: false, message: `Invalid key (Status: ${response.status})` };
    }
  } catch (error) {
    return { valid: false, message: `Network error validating PAT: ${error instanceof Error ? error.message : String(error)}` };
  }
}

