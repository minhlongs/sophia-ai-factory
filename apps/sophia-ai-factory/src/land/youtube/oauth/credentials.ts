import { logger } from '@/seed/utils/logger-utility';

export function getCredentials() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing YouTube OAuth credentials: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI',
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export async function assertOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const text = await res.text();
    logger.error(`${label} failed`, new Error(text), { status: res.status });
    throw new Error(`${label} failed: ${res.status}`);
  }
}
