/**
 * GET /api/internal/runpod-status?jobId={runpodJobId}
 *
 * Polls status of a HunyuanVideo Runpod job.
 * Returns: { status, output?, error? }
 *
 * INTERNAL — called from Inngest polling steps only.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const runpodJobId = searchParams.get('jobId');

  if (!runpodJobId) {
    return NextResponse.json({ error: 'jobId query param required' }, { status: 400 });
  }

  const apiKey = process.env.RUNPOD_API_KEY;
  const endpointId = process.env.RUNPOD_ENDPOINT_ID;

  if (!apiKey || !endpointId) {
    // Stub: return completed with a mock download URL
    return NextResponse.json({
      status: 'COMPLETED',
      output: { download_url: null },
      stub: true,
    });
  }

  const res = await fetch(`https://api.runpod.io/v2/${endpointId}/status/${runpodJobId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Runpod status check failed: ${res.status}` }, { status: 502 });
  }

  const data = (await res.json()) as {
    id: string;
    status: string;
    output?: { r2_key?: string; download_url?: string } | null;
    error?: string | null;
  };

  return NextResponse.json({
    status: data.status,
    output: data.output ?? null,
    error: data.error ?? null,
  });
}
