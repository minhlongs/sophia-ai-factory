import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { inngest } from '@/forest/inngest/client';
import { getD1 } from '@/seed/db/client';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { generateMasterKey } from '@/tree/byok/byok-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

export const dynamic = 'force-dynamic';

const rotateKeyBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminWithRecentAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: { reason?: string };
  try {
    body = rotateKeyBodySchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request body', details: toError(error).message },
      { status: 400 },
    );
  }

  const db = getD1();
  if (!db) {
    return NextResponse.json({ error: 'D1 database binding not available' }, { status: 503 });
  }

  try {
    const currentVersion = await db
      .prepare(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM key_versions`,
      )
      .first<{ next_version: number }>();

    const keyVersion = currentVersion?.next_version ?? 1;
    const encryptedKey = await generateMasterKey();

    await db
      .prepare(
        `INSERT INTO key_versions (key_type, version, encrypted_key, rotated_by)
         VALUES (?, ?, ?, ?)`,
      )
      .bind('master', keyVersion, encryptedKey, auth.user.id)
      .run();

    await inngest.send({
      id: `key-rotation-${keyVersion}-${Date.now()}`,
      name: 'key.rotation.requested',
      data: {
        keyVersion,
        reason: body.reason,
      },
    });

    logger.info('[key-rotation] Rotation requested', {
      keyVersion,
      userId: auth.user.id,
      reason: body.reason,
    });

    return NextResponse.json({
      success: true,
      keyVersion,
      dualDecryptWindowMs: 24 * 60 * 60 * 1000,
      message: 'Key rotation queued. Re-encryption will run asynchronously.',
    });
  } catch (error) {
    logger.error('[key-rotation] Rotation request failed', toError(error));
    return NextResponse.json({ error: 'Failed to request key rotation' }, { status: 500 });
  }
}
