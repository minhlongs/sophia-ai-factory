/**
 * ZuneF Resilient Client
 *
 * Handles ZuneF proxy auth + API calls with:
 * - Device credential management
 * - Token auto-refresh
 * - Circuit breaker on 5xx/cooldown
 * - Exponential backoff retry
 */

import { logger } from '@/seed/utils/logger-utility'
import * as fs from 'fs';

const ZUNEF_BASE_URL = 'https://claude.zunef.com'
const DEVICE_ID_FILE = '/Users/macbook/.claude/zunef-device-id'
const DEVICE_TOKEN_FILE = '/Users/macbook/.claude/zunef-device-token'

interface CircuitState {
  failures: number
  openUntil: number // timestamp
}

const circuit: CircuitState = { failures: 0, openUntil: 0 }
const CIRCUIT_THRESHOLD = 5
const CIRCUIT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

function isCircuitOpen(): boolean {
  return Date.now() < circuit.openUntil
}

function recordSuccess(): void {
  circuit.failures = 0
}

function recordFailure(): void {
  circuit.failures++
  if (circuit.failures >= CIRCUIT_THRESHOLD && circuit.openUntil === 0) {
    circuit.openUntil = Date.now() + CIRCUIT_TIMEOUT_MS
    logger.warn('[zunef-client] Circuit breaker opened', {
      failures: circuit.failures,
      openUntil: new Date(circuit.openUntil).toISOString(),
    })
  }
}

async function getOrCreateDeviceId(): Promise<string> {
  try {
    if (await fileExists(DEVICE_ID_FILE)) {
      return readFile(DEVICE_ID_FILE)
    }
    const newId = `device-${crypto.randomUUID()}`
    await writeFile(DEVICE_ID_FILE, newId)
    return newId
  } catch (err) {
    logger.error('[zunef-client] Device ID error', { error: String(err) })
    throw err
  }
}

interface TokenData {
  token: string;
  expiresAt: number;
}

interface ZuneFResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface TokenResponse {
  token: string;
  expiresIn: number; // seconds
}

// ... existing code ...

async function getOrRefreshToken(deviceId: string): Promise<string> {
  try {
    if (await fileExists(DEVICE_TOKEN_FILE)) {
      const raw = readFile(DEVICE_TOKEN_FILE);
      const tokenData: TokenData = JSON.parse(raw);
      if (tokenData.expiresAt > Date.now() + 60_000) {
        return tokenData.token;
      }
    }

    // Fetch new token from ZuneF auth endpoint
    const res = await fetch(`${ZUNEF_BASE_URL}/api/claude-code/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    if (!res.ok) {
      throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
    }

    const tokenResponse: TokenResponse = await res.json();
    const tokenData: TokenData = {
      token: tokenResponse.token,
      expiresAt: Date.now() + tokenResponse.expiresIn * 1000,
    };
    await writeFile(DEVICE_TOKEN_FILE, JSON.stringify(tokenData));
    return tokenData.token;
  } catch (err) {
    logger.error('[zunef-client] Token refresh failed', { error: String(err) });
    throw err;
  }
}

export async function zunefChatCompletion(
  messages: Array<{ role: string; content: string }>,
  options: { model?: string } = {}
): Promise<string> {
  if (isCircuitOpen()) {
    throw new Error('Circuit breaker open — ZuneF proxy degraded')
  }

  const deviceId = await getOrCreateDeviceId()
  const token = await getOrRefreshToken(deviceId)

  const maxRetries = 8
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const res = await fetch(`${ZUNEF_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options.model || 'claude-3.5-sonnet',
          messages,
          max_tokens: 4096,
        }),
      })

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '5')
        await sleep((retryAfter + Math.random()) * 1000)
        attempt++
        continue
      }

      if (res.status >= 500) {
        const text = await res.text()
        if (text.includes('cooldown') || text.includes('cooling down')) {
          throw new Error(`ZuneF cooldown: ${text}`)
        }
        throw new Error(`ZuneF error ${res.status}: ${text}`)
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`ZuneF error ${res.status}: ${text}`)
      }

      const data: ZuneFResponse = await res.json()
      recordSuccess()
      return data.choices[0]?.message?.content || ''
    } catch (err) {
      attempt++
      if (attempt >= maxRetries) {
        recordFailure()
        throw err
      }
      const delay = Math.min(1000 * 2 ** attempt + Math.random() * 1000, 30_000)
      await sleep(delay)
    }
  }

  throw new Error('ZuneF: max retries exceeded')
}

// Helpers (polyfill Node fs/crypto if running in browser)
function fileExists(path: string): boolean {
  return fs.existsSync(path)
}

function readFile(path: string): string {
  return fs.readFileSync(path, 'utf-8')
}

function writeFile(path: string, content: string): void {
  fs.writeFileSync(path, content)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function resetZuneFCircuit(): void {
  circuit.failures = 0
  circuit.openUntil = 0
  logger.info('[zunef-client] Circuit reset')
}

export function getZuneFCircuitState(): { failures: number; openUntil: number } {
  return { ...circuit }
}