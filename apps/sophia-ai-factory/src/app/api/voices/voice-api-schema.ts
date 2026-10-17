/**
 * Voice Library API validation schemas, constants, and upload helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enforceFileSizeLimit,
  enforceMimeAllowlist,
  FileUploadPolicyError,
} from '@/seed/security/file-upload-policy';

/** 10 MB ceiling for reference audio — voices rarely exceed a few MB */
export const VOICE_MAX_BYTES = 10 * 1024 * 1024;

/** Allowed audio MIME types for reference voice uploads */
export const VOICE_MIME_ALLOWLIST = [
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
] as const;

export const SUPPORTED_LANGUAGES = [
  'en', 'vi', 'es', 'fr', 'de', 'ja', 'ko', 'zh',
  'pt', 'ru', 'ar', 'it', 'pl', 'nl', 'tr', 'cs',
] as const;

export const createVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  language: z.enum(SUPPORTED_LANGUAGES).default('en'),
  consent: z.boolean().refine((v) => v === true, {
    message: 'Consent must be explicitly given (true)',
  }),
});

export interface VoiceRow {
  id: string;
  name: string;
  language: string;
  ref_audio_r2_key: string;
  created_at: number;
}

export function randomVoiceId(): string {
  return crypto.randomUUID();
}

export async function parseAndValidateVoiceUpload(
  request: NextRequest
): Promise<
  | {
      ok: true;
      name: string;
      language: z.infer<typeof createVoiceSchema>['language'];
      audioFile: Blob;
      contentType: string;
    }
  | { ok: false; response: NextResponse }
> {
  try {
    enforceFileSizeLimit(request, VOICE_MAX_BYTES);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return {
        ok: false,
        response: NextResponse.json({ error: err.message }, { status: err.status }),
      };
    }
    throw err;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 }),
    };
  }

  const parsed = createVoiceSchema.safeParse({
    name: formData.get('name'),
    language: formData.get('language') ?? 'en',
    consent: formData.get('consent') === 'true',
  });

  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }),
    };
  }

  const audioFile = formData.get('audio');
  if (!audioFile || !(audioFile instanceof Blob)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'audio file is required' }, { status: 400 }),
    };
  }

  const declaredMime = audioFile instanceof File ? (audioFile.type || 'audio/wav') : 'audio/wav';
  try {
    enforceMimeAllowlist(declaredMime, VOICE_MIME_ALLOWLIST);
  } catch (err) {
    if (err instanceof FileUploadPolicyError) {
      return {
        ok: false,
        response: NextResponse.json({ error: err.message }, { status: err.status }),
      };
    }
    throw err;
  }

  return {
    ok: true,
    name: parsed.data.name,
    language: parsed.data.language,
    audioFile,
    contentType: declaredMime,
  };
}
