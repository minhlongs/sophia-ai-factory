export const ZUNEF_BASE_URL = 'https://claude.zunef.com';

// Shared with any caller that needs to seed or evict credentials.
export const ZUNEF_KV_PREFIX = 'zunef:';
export const DEVICE_ID_KEY = `${ZUNEF_KV_PREFIX}device-id`;
export const DEVICE_TOKEN_KEY = `${ZUNEF_KV_PREFIX}device-token`;

export const PREFIX = ZUNEF_KV_PREFIX;

export const TOKEN_FRESH_SKEW_MS = 60_000;

export interface TokenData {
  token: string;
  expiresAt: number; // epoch ms
}

export interface ZuneFResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
