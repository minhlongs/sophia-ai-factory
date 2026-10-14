import { generateJti, hmacBase64url } from '@/seed/auth/openclaw-token';
import { ExchangeResponse } from './types';

export async function mintOpenClawToken(
  userId: string,
  ttlSeconds: number,
  nowSec: number,
  secret: string,
): Promise<ExchangeResponse> {
  const jti = generateJti();
  const expiresAt = nowSec + ttlSeconds;
  const payload = `${userId}.${expiresAt}.${jti}`;
  const sig = await hmacBase64url(payload, secret);
  const token = `${payload}.${sig}`;

  return { token, expiresAt, userId, jti };
}
