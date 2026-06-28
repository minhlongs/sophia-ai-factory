/**
 * Tests for file-upload-policy.ts
 *
 * Covers: size ceiling, MIME allowlist, safe storage key (traversal prevention).
 */

import { describe, it, expect } from 'vitest';
import {
  enforceFileSizeLimit,
  enforceMimeAllowlist,
  safeStorageKey,
  FileUploadPolicyError,
  DEFAULT_MAX_BYTES,
} from '../file-upload-policy';

// ---------------------------------------------------------------------------
// enforceFileSizeLimit
// ---------------------------------------------------------------------------

describe('enforceFileSizeLimit', () => {
  const makeReq = (contentLength: string | null) => ({
    headers: { get: (name: string) => (name === 'content-length' ? contentLength : null) },
  });

  it('passes when Content-Length is absent', () => {
    expect(() => enforceFileSizeLimit(makeReq(null))).not.toThrow();
  });

  it('passes when Content-Length is within limit', () => {
    expect(() => enforceFileSizeLimit(makeReq('1000000'))).not.toThrow();
  });

  it('passes when Content-Length equals limit exactly', () => {
    expect(() => enforceFileSizeLimit(makeReq(String(DEFAULT_MAX_BYTES)))).not.toThrow();
  });

  it('throws 413 when Content-Length exceeds default limit', () => {
    const req = makeReq(String(DEFAULT_MAX_BYTES + 1));
    expect(() => enforceFileSizeLimit(req)).toThrow(FileUploadPolicyError);
    try {
      enforceFileSizeLimit(req);
    } catch (err) {
      expect((err as FileUploadPolicyError).status).toBe(413);
    }
  });

  it('throws 413 when Content-Length exceeds custom limit', () => {
    const req = makeReq('5000001');
    expect(() => enforceFileSizeLimit(req, 5_000_000)).toThrow(FileUploadPolicyError);
  });

  it('passes when Content-Length is non-numeric (graceful)', () => {
    // Non-numeric header → NaN → skip check
    expect(() => enforceFileSizeLimit(makeReq('not-a-number'))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// enforceMimeAllowlist
// ---------------------------------------------------------------------------

describe('enforceMimeAllowlist', () => {
  const AUDIO_ALLOWED = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/webm'] as const;

  it('passes for allowed MIME type', () => {
    expect(() => enforceMimeAllowlist('audio/wav', AUDIO_ALLOWED)).not.toThrow();
  });

  it('passes for allowed MIME type case-insensitively', () => {
    expect(() => enforceMimeAllowlist('Audio/WAV', AUDIO_ALLOWED)).not.toThrow();
  });

  it('strips MIME parameters before comparing', () => {
    expect(() => enforceMimeAllowlist('audio/wav; codecs=1', AUDIO_ALLOWED)).not.toThrow();
  });

  it('throws 415 for disallowed MIME type', () => {
    expect(() => enforceMimeAllowlist('video/mp4', AUDIO_ALLOWED)).toThrow(FileUploadPolicyError);
    try {
      enforceMimeAllowlist('video/mp4', AUDIO_ALLOWED);
    } catch (err) {
      expect((err as FileUploadPolicyError).status).toBe(415);
    }
  });

  it('throws 415 for application/octet-stream when not in list', () => {
    expect(() => enforceMimeAllowlist('application/octet-stream', AUDIO_ALLOWED)).toThrow(
      FileUploadPolicyError,
    );
  });

  it('throws 415 for empty string', () => {
    expect(() => enforceMimeAllowlist('', AUDIO_ALLOWED)).toThrow(FileUploadPolicyError);
  });
});

// ---------------------------------------------------------------------------
// safeStorageKey
// ---------------------------------------------------------------------------

describe('safeStorageKey', () => {
  it('builds correct key for normal filename', () => {
    const key = safeStorageKey('tenant-123', 'voices/abc', 'ref.wav');
    expect(key).toBe('tenant-123/voices/abc/ref.wav');
  });

  it('strips directory prefix from user-supplied filename', () => {
    const key = safeStorageKey('t1', 'uploads', '../../etc/passwd');
    // After stripping, only 'passwd' remains — but it has no extension/dot-only check
    // The important thing: no ".." in output
    expect(key).not.toContain('..');
    expect(key).toBe('t1/uploads/passwd');
  });

  it('handles Windows-style backslash paths', () => {
    const key = safeStorageKey('t1', 'uploads', '..\\..\\evil.txt');
    expect(key).not.toContain('..');
    expect(key).toBe('t1/uploads/evil.txt');
  });

  it('throws 400 for empty filename after sanitisation', () => {
    expect(() => safeStorageKey('t1', 'uploads', '../../..')).toThrow(FileUploadPolicyError);
    try {
      safeStorageKey('t1', 'uploads', '/');
    } catch (err) {
      expect((err as FileUploadPolicyError).status).toBe(400);
    }
  });

  it('throws 400 for dot-only filename', () => {
    expect(() => safeStorageKey('t1', 'uploads', '.')).toThrow(FileUploadPolicyError);
    expect(() => safeStorageKey('t1', 'uploads', '..')).toThrow(FileUploadPolicyError);
  });

  it('throws 400 for filename with disallowed characters', () => {
    expect(() => safeStorageKey('t1', 'uploads', 'file name with spaces.wav')).toThrow(
      FileUploadPolicyError,
    );
    try {
      safeStorageKey('t1', 'uploads', 'shell$(command).wav');
    } catch (err) {
      expect((err as FileUploadPolicyError).status).toBe(400);
    }
  });

  it('throws 400 when tenantId is empty', () => {
    expect(() => safeStorageKey('', 'uploads', 'file.wav')).toThrow(FileUploadPolicyError);
  });

  it('throws 400 when serverPrefix is empty', () => {
    expect(() => safeStorageKey('t1', '', 'file.wav')).toThrow(FileUploadPolicyError);
  });

  it('accepts valid alphanumeric, dot, hyphen, underscore filenames', () => {
    const key = safeStorageKey('t1', 'voices/x', 'my_audio-v2.wav');
    expect(key).toBe('t1/voices/x/my_audio-v2.wav');
  });
});
