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
import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { uploadToR2 } from '@/land/video/storage/r2-multipart-upload';
import { logger } from '@/seed/utils/logger-utility';
import {
  enforceFileSizeLimit,
  enforceMimeAllowlist,
  FileUploadPolicyError,
} from '@/seed/security/file-upload-policy';

/** 10 MB ceiling for reference audio — voices rarely exceed a few MB */
const VOICE_MAX_BYTES = 10 * 1024 * 1024;
/** Allowed audio MIME types for reference voice uploads */
const VOICE_MIME_ALLOWLIST = ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/mp4'] as const;

const SUPPORTED_LANGUAGES = ['en', 'vi', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'pt', 'ru', 'ar', 'it', 'pl', 'nl', 'tr', 'cs'] as const;

const createVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),
  consent: z.boolean().refine((v) => v === true, {
    message: 'Consent must be explicitly given (true)',
  }),
});

function randomId(): string {
  return crypto.randomUUID();
}

/** POST /api/voices */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (user as unknown as { tenantId?: string }).tenantId ?? user.id;

  // Policy: size ceiling (early reject before reading body)
  try {
    enforceFileSizeLimit(request, VOICE_MAX_BYTES);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const name = formData.get('name');
  const language = formData.get('language') ?? 'en';
  const consentRaw = formData.get('consent');
  const audioFile = formData.get('audio');

  const parsed = createVoiceSchema.safeParse({
    name,
    language,
    consent: consentRaw === 'true',
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Accept File or Blob (File extends Blob; both have arrayBuffer())
  if (!audioFile || !(audioFile instanceof Blob)) {
    return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
  }

  // Policy: MIME allowlist — check declared type from the file entry
  const declaredMime = audioFile instanceof File ? (audioFile.type || 'audio/wav') : 'audio/wav';
  try {
    enforceMimeAllowlist(declaredMime, VOICE_MIME_ALLOWLIST);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const bucketRef = await getVideoBucket();
  if (!bucketRef) {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  const voiceId = randomId();
  // Policy: hardcoded prefix — user controls nothing about the R2 key path
  const r2Key = `tenants/${tenantId}/voices/${voiceId}/ref.wav`;

  try {
    const audioBuffer = await audioFile.arrayBuffer();
    const contentType = audioFile instanceof File ? audioFile.type || 'audio/wav' : 'audio/wav';
    await uploadToR2({
      bucket: bucketRef.bucket,
      key: r2Key,
      data: audioBuffer,
      contentType,
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
      name: parsed.data.name,
      language: parsed.data.language,
      ref_audio_r2_key: r2Key,
      consent_given_at: now,
      created_at: now,
    });
  } catch (err) {
    logger.warn('[Voices] DB insert failed', { error: String(err) });
    return NextResponse.json({ error: 'Failed to save voice record' }, { status: 500 });
  }

  return NextResponse.json({ id: voiceId, name: parsed.data.name, language: parsed.data.language, r2Key }, { status: 201 });
}

interface VoiceRow {
  id: string;
  name: string;
  language: string;
  ref_audio_r2_key: string;
  created_at: number;
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
