/**
 * POST /api/internal/runpod-trigger
 *
 * Submits a HunyuanVideo job to Runpod serverless endpoint.
 * Accepts: { prompts: string[], durationSec: number, fps: number }
 * Returns: { runpodJobId: string }
 *
 * INTERNAL — called from Inngest steps only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  prompts: z.array(z.string().min(1)).min(1).max(10),
  durationSec: z.number().int().min(5).max(120).default(30),
  fps: z.number().int().min(24).max(60).default(30),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  const { prompts, durationSec, fps } = parsed.data;
  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;

  if (!apiKey || !endpointId) {
    return NextResponse.json({ runpodJobId: 'stub-job-id', stub: true }, { status: 200 });
  }

  const res = await fetch(`https://api.runpod.io/v2/${endpointId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ input: { prompts, duration: durationSec, fps } }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Runpod submit failed: ${res.status}` }, { status: 502 });
  }

  const data = (await res.json()) as { id: string; status: string };
  return NextResponse.json({ runpodJobId: data.id, status: data.status });
}
