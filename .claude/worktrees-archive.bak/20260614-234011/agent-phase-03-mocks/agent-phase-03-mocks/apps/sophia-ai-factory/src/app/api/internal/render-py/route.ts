/**
 * POST /api/internal/render-py
 *
 * Internal proxy to the MoviePy Fly.io render service.
 * Accepts: { templateId, audioR2Key, scenes, outputFormat? }
 * Returns: video/mp4 stream or JSON error.
 *
 * INTERNAL — must be called only from Inngest steps (no public auth).
 * Cloudflare Workers edge function proxy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyInternalSecret } from '@/seed/security/verify-internal-secret';

const bodySchema = z.object({
  templateId: z.string().min(1),
  audioR2Key: z.string().min(1),
  scenes: z.array(z.string()).min(1).max(10),
  outputFormat: z.enum(['mp4']).default('mp4'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyInternalSecret(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { templateId, audioR2Key, scenes, outputFormat } = parsed.data;
  const flyUrl = process.env.MOVIEPY_FLY_URL;

  if (!flyUrl) {
    // Return stub mp4 when service not configured
    const stub = Buffer.from('AAAAHGZ0eXBpc29tAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAG21kYXQ=', 'base64');
    return new NextResponse(stub, {
      status: 200,
      headers: { 'Content-Type': 'video/mp4', 'X-Render-Mode': 'stub' },
    });
  }

  const upstream = await fetch(`${flyUrl}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId, audio_r2_key: audioR2Key, scenes, output_format: outputFormat }),
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `MoviePy service error: ${upstream.status}` },
      { status: upstream.status >= 500 ? 502 : upstream.status },
    );
  }

  const buffer = await upstream.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: { 'Content-Type': 'video/mp4' },
  });
}
