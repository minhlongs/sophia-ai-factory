import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getD1Raw } from '@/seed/db/client';
import { openEmailRefundReceiptReview, openEmailReviewSchema, attachEmailReceiptEvidence, attachEmailEvidenceMetaSchema } from '@/land/payments/manual-pilot/manual-pilot-email-review';
import { emailReviewSelectionSchema, reviewEmailReceiptAuthority } from '@/land/payments/manual-pilot/manual-pilot-email-eligibility';

export const dynamic = 'force-dynamic';
const actions = z.discriminatedUnion('action', [
  openEmailReviewSchema.extend({ action: z.literal('open') }),
  emailReviewSelectionSchema.extend({ action: z.literal('verify_receipt') }),
  emailReviewSelectionSchema.extend({ action: z.literal('assess_eligibility') }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;
  try {
    const isJson = request.headers.get('content-type')?.split(';')[0] === 'application/json';
    const limit = isJson ? 8192 : 5242880;
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > limit) { await reader.cancel(); return NextResponse.json({ error: 'Body too large' }, { status: 413 }); }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const db = await getD1Raw();
    if (isJson) {
      const parsed = actions.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
      if (!parsed.success) return NextResponse.json({ error: 'Invalid review action' }, { status: 400 });
      const { action, ...input } = parsed.data;
      const result = action === 'open'
        ? await openEmailRefundReceiptReview(db, openEmailReviewSchema.parse(input), auth.user.id)
        : await reviewEmailReceiptAuthority(db, input, auth.user.id);
      return NextResponse.json(result.ok ? result.value : result.error, { status: result.ok ? 200 : 409 });
    }
    const meta = attachEmailEvidenceMetaSchema.safeParse({
      reviewId: request.headers.get('x-review-id'), orderId: request.headers.get('x-order-id'),
      orgId: request.headers.get('x-org-id'), filename: request.headers.get('x-artifact-filename'), mimeType: request.headers.get('content-type'),
    });
    if (!meta.success) return NextResponse.json({ error: 'Invalid receipt metadata' }, { status: 400 });
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true });
    const bucket = (context.env as unknown as { PRIVATE_BANK_ARTIFACTS?: R2Bucket }).PRIVATE_BANK_ARTIFACTS;
    if (!bucket) return NextResponse.json({ error: 'Private evidence storage unavailable' }, { status: 503 });
    const result = await attachEmailReceiptEvidence(db, { ...meta.data, bytes }, auth.user.id, {
      put: async (key, value, metadata) => { await bucket.put(key, new Uint8Array(value), { customMetadata: { sha256: metadata.sha256 } }); },
    });
    return NextResponse.json(result.ok ? { reviewId: result.value.reviewId, state: result.value.state } : result.error,
      { status: result.ok ? 200 : 409 });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to process receipt review' }, { status: error instanceof SyntaxError ? 400 : 503 });
  }
}
