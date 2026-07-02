import { NextRequest, NextResponse } from 'next/server';
import { getD1Raw } from '@/seed/db/client';
import { toError } from '@/seed/utils/to-error';

export const runtime = 'edge';

function verifyHarnessAuth(req: NextRequest): boolean {
  const harnessSecret = process.env.HARNESS_SECRET || process.env.CRON_SECRET || 'dev-harness-secret';
  const headerSecret = req.headers.get('x-harness-secret') || req.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (process.env.NODE_ENV === 'development' && !headerSecret) {
    return true;
  }
  
  return headerSecret === harnessSecret;
}

interface TestResultPayload {
  test_name: 'd1_ping' | 'r2_storage' | 'api_openrouter' | 'api_elevenlabs' | 'api_heygen' | 'remotion_render';
  status: 'success' | 'failed';
  duration_ms: number;
  error_message?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

interface UpdateJobPayload {
  status: 'completed' | 'failed';
  results?: TestResultPayload[];
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!verifyHarnessAuth(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing job ID' }, { status: 400 });
    }

    const body = (await request.json()) as UpdateJobPayload;
    const { status, results } = body;

    if (!['completed', 'failed'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 });
    }

    const db = await getD1Raw();

    // Verify job exists
    const jobExists = await db.prepare('SELECT id FROM harness_jobs WHERE id = ?')
      .bind(id)
      .first();

    if (!jobExists) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    const statements = [
      db.prepare(
        "UPDATE harness_jobs SET status = ?, updated_at = datetime('now') WHERE id = ?"
      )
      .bind(status, id)
    ];

    if (results && Array.isArray(results)) {
      for (const res of results) {
        const metadataStr = typeof res.metadata === 'object' 
          ? JSON.stringify(res.metadata) 
          : (res.metadata || null);

        statements.push(
          db.prepare(
            "INSERT INTO harness_results (id, job_id, test_name, status, duration_ms, error_message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)"
          )
          .bind(
            crypto.randomUUID(),
            id,
            res.test_name,
            res.status,
            res.duration_ms,
            res.error_message || null,
            metadataStr
          )
        );
      }
    }

    await db.batch(statements);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 });
  }
}
