import { logger } from '@/seed/utils/logger-utility';
import { storageGet, storageSet, storageDelete } from '@/seed/kv/kv-storage-ops';
import {
  DEVICE_ID_KEY,
  DEVICE_TOKEN_KEY,
  ZUNEF_BASE_URL,
  type TokenData,
} from './types';

function tokenFromRaw(raw: string): TokenData | null {
  try {
    return JSON.parse(raw) as TokenData;
  } catch {
    return null;
  }
}

async function loadValidToken(): Promise<string | null> {
  const raw = await storageGet(DEVICE_TOKEN_KEY);
  if (!raw) return null;
  const tokenData = tokenFromRaw(raw);
  if (tokenData && tokenData.expiresAt > Date.now() + 60_000) {
    return tokenData.token;
  }
  return null;
}

export async function getOrRefreshToken(deviceId: string): Promise<string> {
  try {
    const existing = await loadValidToken();
    if (existing) return existing;

    const res = await fetch(`${ZUNEF_BASE_URL}/api/claude-code/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    if (!res.ok) {
      throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
    }

    const tokenResponse: { token: string; expiresIn: number } = await res.json();
    const tokenData: TokenData = {
      token: tokenResponse.token,
      expiresAt: Date.now() + tokenResponse.expiresIn * 1_000,
    };
    await storageSet(DEVICE_TOKEN_KEY, JSON.stringify(tokenData));
    return tokenData.token;
  } catch (err) {
    logger.error('[zunef-client] Token refresh failed', { error: String(err) });
    throw err;
  }
}

export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const stored = await storageGet(DEVICE_ID_KEY);
    if (stored) return stored;

    const newId = `device-${crypto.randomUUID()}`;
    await storageSet(DEVICE_ID_KEY, newId);
    return newId;
  } catch (err) {
    logger.error('[zunef-client] Device ID error', { error: String(err) });
    throw err;
  }
}

export async function clearZuneFCredentials(): Promise<void> {
  await Promise.all([
    storageDelete(DEVICE_ID_KEY),
    storageDelete(DEVICE_TOKEN_KEY),
  ]);
}
