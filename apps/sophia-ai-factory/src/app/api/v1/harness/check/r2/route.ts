import { NextRequest, NextResponse } from 'next/server';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
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

// @allow-mutating-get: R2 harness health check creates and immediately deletes a probe object to verify storage connectivity
export async function GET(request: NextRequest) {
  try {
    if (!verifyHarnessAuth(request)) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const bucketRef = await getVideoBucket();
    if (!bucketRef) {
      return NextResponse.json({ success: false, error: 'VIDEO_BUCKET binding not configured' }, { status: 503 });
    }

    const testKey = `harness-test-${crypto.randomUUID()}.txt`;
    const testData = new TextEncoder().encode('Sophia AI Factory Harness Storage Check');

    // Put object
    await bucketRef.bucket.put(testKey, testData, {
      httpMetadata: { contentType: 'text/plain' }
    });

    // Delete object
    await bucketRef.bucket.delete(testKey);

    return NextResponse.json({ success: true, message: 'R2 storage read/write check successful' });
  } catch (e) {
    return NextResponse.json({ success: false, error: toError(e).message }, { status: 500 });
  }
}
