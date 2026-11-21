import { NextRequest, NextResponse } from 'next/server';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { getD1Raw } from '@/seed/db/client';
import { resolvePilotBankConfig } from '@/seed/config/pilot-bank-config';
import { intakePrivateBankArtifact } from '@/land/payments/manual-pilot/manual-pilot-bank-artifact-intake';
import { verifyAndIngestOperatorBankArtifact, operatorBankCheckSchema } from '@/land/payments/manual-pilot/manual-pilot-bank-verifier';

export const dynamic = 'force-dynamic';

import { bankArtifactIntakeMetaSchema, MAX_BANK_ARTIFACT_BYTES } from '@/land/payments/manual-pilot/manual-pilot-bank-artifact-intake';

export async function POST(request: NextRequest) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof Response) return auth;
  try {
    const context = await import('@opennextjs/cloudflare').then((m) => m.getCloudflareContext({ async: true }));
    const bucket = (context.env as unknown as { PRIVATE_BANK_ARTIFACTS?: R2Bucket }).PRIVATE_BANK_ARTIFACTS;
    if (!bucket) return NextResponse.json({ error: 'Private artifact storage unavailable' }, { status: 503 });
    const db = await getD1Raw();
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    const json = request.headers.get('content-type')?.split(';')[0] === 'application/json';
    const limit = json ? 8192 : MAX_BANK_ARTIFACT_BYTES;
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) {
        await reader.cancel();
        return NextResponse.json({ error: 'Body too large' }, { status: 413 });
      }
      parts.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    if (json) {
      const input: unknown = JSON.parse(new TextDecoder().decode(bytes));
      const check = operatorBankCheckSchema.safeParse(input);
      if (!check.success) return NextResponse.json({ error: 'Invalid operator check' }, { status: 400 });
      const config = await resolvePilotBankConfig();
      if (!config.configured) return NextResponse.json({ error: 'Pilot bank not configured' }, { status: 503 });
      const result = await verifyAndIngestOperatorBankArtifact(db, check.data, auth.user.id, config.accountNumber, {
        expectedBankIdentity: config.bankName,
        read: async (key) => {
          const object = await bucket.get(key);
          return object && object.size <= MAX_BANK_ARTIFACT_BYTES ? new Uint8Array(await object.arrayBuffer()) : null;
        },
      });
      return NextResponse.json(result.ok ? result.value : { code: result.error.code }, { status: result.ok ? 200 : 409 });
    }
    const meta = bankArtifactIntakeMetaSchema.safeParse({
      orderId: request.headers.get('x-order-id'), orgId: request.headers.get('x-org-id'),
      direction: request.headers.get('x-bank-direction'), filename: request.headers.get('x-artifact-filename'),
      mimeType: request.headers.get('content-type'),
    });
    if (!meta.success) return NextResponse.json({ error: 'Invalid artifact metadata' }, { status: 400 });
    const result = await intakePrivateBankArtifact(db, { ...meta.data, bytes }, auth.user.id, {
      put: async (key, value, metadata) => {
        await bucket.put(key, new Uint8Array(value), { customMetadata: { sha256: metadata.sha256 } });
      },
    });
    return NextResponse.json(result.ok ? { artifactId: result.value.artifactId } : { code: result.error.code }, { status: result.ok ? 201 : 409 });
  } catch (error) {
    return NextResponse.json({ error: 'Unable to process bank evidence' }, { status: error instanceof SyntaxError ? 400 : 503 });
  }
}
