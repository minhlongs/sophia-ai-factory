/**
 * Voice Library API
 *
 * POST /api/voices — Upload reference audio + create voice record
 * GET  /api/voices — List tenant voices
 *
 * Requires: authenticated session (getCurrentUser).
 * Tenant scoping enforced via tenantId from user session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { uploadToR2 } from '@/land/video/storage/r2-multipart-upload';
import { logger } from '@/seed/utils/logger-utility';
import {
  parseAndValidateVoiceUpload,
  randomVoiceId,
  type VoiceRow,
} from './voice-api-schema';

/** POST /api/voices */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (user as unknown as { tenantId?: string }).tenantId ?? user.id;

  const validated = await parseAndValidateVoiceUpload(request);
  if (!validated.ok) {
    return validated.response;
  }

  const bucketRef = await getVideoBucket();
  if (!bucketRef) {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  const voiceId = randomVoiceId();
  const r2Key = `tenants/${tenantId}/voices/${voiceId}/ref.wav`;

  try {
    const audioBuffer = await validated.audioFile.arrayBuffer();
    await uploadToR2({
      bucket: bucketRef.bucket,
      key: r2Key,
      data: audioBuffer,
      contentType: validated.contentType,
    });
  } catch (err) {
    logger.warn('[Voices] R2 upload failed', { error: String(err) });
    return NextResponse.json({ error: 'Audio upload failed' }, { status: 500 });
  }

  const now = Math.floor(Date.now() / 1000);
  const db = createServerClient();

  try {
    await db.from('voices').insert({
      id: voiceId,
      tenant_id: tenantId,
      user_id: user.id,
      name: validated.name,
      language: validated.language,
      ref_audio_r2_key: r2Key,
      consent_given_at: now,
      created_at: now,
    });
  } catch (err) {
    logger.warn('[Voices] DB insert failed', { error: String(err) });
    return NextResponse.json({ error: 'Failed to save voice record' }, { status: 500 });
  }

  return NextResponse.json(
    { id: voiceId, name: validated.name, language: validated.language, r2Key },
    { status: 201 }
  );
}

/** GET /api/voices */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (user as unknown as { tenantId?: string }).tenantId ?? user.id;
  const db = createServerClient();

  const { data, error } = await db
    .from('voices')
    .select('id, name, language, ref_audio_r2_key, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.warn('[Voices] List query failed', { error: String(error) });
    return NextResponse.json({ error: 'Failed to load voices' }, { status: 500 });
  }

  return NextResponse.json({ voices: (data ?? []) as unknown as VoiceRow[] });
}
