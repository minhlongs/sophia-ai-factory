/**
 * Discord HTTP Interactions Webhook (Cloudflare Workers Native, Zero WebSocket).
 *
 * Verifies Ed25519 signatures via WebCrypto (`X-Signature-Ed25519` +
 * `X-Signature-Timestamp`) and serves `/deal` and `/rebate` slash commands.
 *
 * @module app/api/webhooks/discord/interactions/route
 */

import { NextRequest, NextResponse } from 'next/server';

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function verifyDiscordEd25519(
  rawBody: string,
  signatureHex: string,
  timestamp: string,
  publicKeyHex: string,
): Promise<boolean> {
  const sigBytes = hexToBytes(signatureHex);
  const pubBytes = hexToBytes(publicKeyHex);
  if (!sigBytes || !pubBytes) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      pubBytes.buffer as ArrayBuffer,
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    const payload = new TextEncoder().encode(`${timestamp}${rawBody}`);
    return await crypto.subtle.verify(
      'Ed25519',
      key,
      sigBytes.buffer as ArrayBuffer,
      payload.buffer as ArrayBuffer,
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const publicKey = (process.env.DISCORD_PUBLIC_KEY ?? '').trim();
  if (!publicKey) {
    return NextResponse.json({ error: 'DISCORD_PUBLIC_KEY_NOT_CONFIGURED' }, { status: 503 });
  }

  const signature = request.headers.get('x-signature-ed25519') ?? '';
  const timestamp = request.headers.get('x-signature-timestamp') ?? '';
  const rawBody = await request.text();

  const valid = await verifyDiscordEd25519(rawBody, signature, timestamp, publicKey);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { type?: number; data?: { name?: string } };
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  const cmd = body.data?.name ?? 'deal';
  const content =
    cmd === 'rebate'
      ? '📊 **Sophia CEX Fee-Rebate Calculator**: Mở công cụ tính hoàn phí tại https://sophia-ai-factory.agencyos-openclaw.workers.dev/vi/hub/sophia (#QuảngCáo)'
      : '⚡ **Sophia Verified Crypto & SaaS Deals**: Xem danh sách kèo đã kiểm duyệt tại https://sophia-ai-factory.agencyos-openclaw.workers.dev/vi/hub/sophia (#QuảngCáo)';

  return NextResponse.json({ type: 4, data: { content } });
}
