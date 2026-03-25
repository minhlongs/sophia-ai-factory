/**
 * SSE endpoint — /api/v1/missions/:id/stream
 *
 * Streams real-time mission status updates via Server-Sent Events.
 * Auth: Authorization: Bearer <api_key>
 * Close: terminal state (completed/failed/cancelled) or 5-minute timeout.
 *
 * Query params:
 *   ?stream=tokens  — enable faster polling (500ms) + delta events for partial results
 */

import { NextRequest } from 'next/server';
import { getD1Client } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const POLL_INTERVAL_MS = 2_000;
const FAST_POLL_INTERVAL_MS = 500;
const HEARTBEAT_INTERVAL_MS = 15_000;
const MAX_STREAM_MS = 5 * 60 * 1_000;
const TERMINAL_STATES = new Set(['completed', 'failed', 'cancelled']);

async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sseEvent(event: string, payload: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // --- Auth ---
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) {
    return new Response('Missing Authorization header', { status: 401 });
  }
  const bearerToken = auth.slice(7).trim();
  if (!bearerToken) {
    return new Response('Empty bearer token', { status: 401 });
  }

  const db = await getD1Client();
  const keyHash = await hashApiKey(bearerToken);

  const { data: apiKey } = await db
    .from('raas_api_keys')
    .select('id, org_id')
    .eq('key_hash', keyHash)
    .eq('is_active', 1)
    .single();

  if (!apiKey) {
    return new Response('Invalid or expired API key', { status: 401 });
  }

  const { id: missionId } = await params;

  // Verify mission belongs to this org
  const { data: missionCheck } = await db
    .from('missions')
    .select('id')
    .eq('id', missionId)
    .eq('org_id', (apiKey as Record<string, unknown>).org_id)
    .single();

  if (!missionCheck) {
    return new Response('Mission not found', { status: 404 });
  }

  const streamTokens = request.nextUrl.searchParams.get('stream') === 'tokens';

  // --- SSE Stream ---
  const encoder = new TextEncoder();
  let lastStatus: string | null = null;
  let lastStepCount = 0;
  let lastPartialResult: string | null = null;
  let streamStartEmitted = false;

  const stream = new ReadableStream({
    async start(controller) {
      const deadline = Date.now() + MAX_STREAM_MS;
      let heartbeatAt = Date.now() + HEARTBEAT_INTERVAL_MS;

      const enqueue = (chunk: string) =>
        controller.enqueue(encoder.encode(chunk));

      const poll = async (): Promise<boolean> => {
        const { data: mission } = await db
          .from('missions')
          .select('status, result, error_message, partial_result')
          .eq('id', missionId)
          .single();

        if (!mission) return true; // close — mission gone

        const m = mission as Record<string, unknown>;
        const status = m.status as string;

        // Emit status change
        if (status !== lastStatus) {
          lastStatus = status;
          enqueue(
            sseEvent('status', {
              status,
              progress: status === 'running' ? 0.5 : status === 'completed' ? 1 : 0,
            })
          );

          // Emit stream_start when execution begins (token streaming mode)
          if (streamTokens && status === 'executing' && !streamStartEmitted) {
            streamStartEmitted = true;
            enqueue(sseEvent('stream_start', { mission_id: missionId }));
          }

          if (status === 'completed' && m.result) {
            enqueue(sseEvent('result', { result: m.result }));
            return true;
          }

          if (status === 'failed') {
            enqueue(sseEvent('error', { message: m.error_message ?? 'Mission failed' }));
            return true;
          }

          if (TERMINAL_STATES.has(status)) return true;
        }

        // Token streaming: emit delta events for partial_result changes
        if (streamTokens && status === 'executing') {
          const partial = m.partial_result as string | null;
          if (partial && partial !== lastPartialResult) {
            const prevLen = lastPartialResult?.length ?? 0;
            const delta = partial.slice(prevLen);
            if (delta) {
              enqueue(sseEvent('delta', { text: delta }));
            }
            lastPartialResult = partial;
          }
        }

        // Poll mission_steps for progress
        const { data: steps } = await db
          .from('mission_steps')
          .select('step_name, step_index, status')
          .eq('mission_id', missionId);

        const stepList = (steps ?? []) as Array<Record<string, unknown>>;
        const completedSteps = stepList.filter((s) => s.status === 'completed');

        if (completedSteps.length > lastStepCount) {
          const latest = completedSteps[completedSteps.length - 1];
          lastStepCount = completedSteps.length;
          enqueue(
            sseEvent('step', {
              step_index: latest.step_index,
              step_name: latest.step_name,
              total_steps: stepList.length,
            })
          );
        }

        return false;
      };

      const intervalMs = streamTokens ? FAST_POLL_INTERVAL_MS : POLL_INTERVAL_MS;

      try {
        while (Date.now() < deadline) {
          const done = await poll();
          if (done) break;

          // Heartbeat
          if (Date.now() >= heartbeatAt) {
            enqueue(sseEvent('heartbeat', { timestamp: new Date().toISOString() }));
            heartbeatAt = Date.now() + HEARTBEAT_INTERVAL_MS;
          }

          await new Promise((r) => setTimeout(r, intervalMs));
        }
      } catch (err) {
        enqueue(sseEvent('error', { message: (err as Error).message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
