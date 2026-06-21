import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { requireAdminWithRecentAuth } from '@/seed/auth/require-admin';
import { generateMasterKey } from '@/tree/byok/byok-crypto';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';

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
    const db = getD1();
    if (!db) {
      return NextResponse.json({ error: 'D1 database binding not available' }, { status: 503 });
    }

    // 1. Get current active version (old version) before creating new one
    const currentVersionRow = await db
      .prepare(
        `SELECT version
         FROM key_versions
         WHERE is_active = 1
         ORDER BY version DESC
         LIMIT 1`,
      )
      .first<{ version: number }>();

    const oldVersion = currentVersionRow?.version ?? 1;

    // 2. Calculate new version
    const nextVersionRow = await db
      .prepare(
        `SELECT COALESCE(MAX(version), 0) + 1 AS next_version
         FROM key_versions`,
      )
      .first<{ next_version: number }>();

    const keyVersion = nextVersionRow?.next_version ?? 1;
    const encryptedKey = await generateMasterKey();

    // 3. Insert new key version (active by default)
    await db
      .prepare(
        `INSERT INTO key_versions (key_type, version, encrypted_key, rotated_by)
         VALUES (?, ?, ?, ?)`,
      )
      .bind('master', keyVersion, encryptedKey, auth.user.id)
      .run();

    // 4. Send Inngest event with both old and new versions
    await inngest.send({
      id: `key-rotation-${keyVersion}-${Date.now()}`,
      name: 'key.rotation.requested',
      data: {
        keyVersion,
        oldVersion,
        reason: body.reason,
      },
    });

    logger.info('[key-rotation] Rotation requested', {
      keyVersion,
      oldVersion,
      userId: auth.user.id,
      reason: body.reason,
    });

    // SOC 2 CC7.2: Audit log for key rotation with immutable hash chain
    await logAuditEvent({
      action: 'key_rotation.requested',
      userId: auth.user.id,
      metadata: {
        keyVersion,
        oldVersion,
        reason: body.reason,
        actorType: 'admin',
      },
    }).catch((err) => {
      logger.error('[key-rotation] Audit log failed', toError(err));
      // Non-blocking: audit is important but rotation should proceed even if audit fails
    });

    return NextResponse.json({
      success: true,
      keyVersion,
      oldVersion,
      dualDecryptWindowMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      message: 'Key rotation queued. Re-encryption will run asynchronously.',
    });
  } catch (error) {
    logger.error('[key-rotation] Rotation request failed', toError(error));
    return NextResponse.json({ error: 'Failed to request key rotation' }, { status: 500 });
  }
}
