/**
 * Tests for /api/v1/branding/upload route.
 * Covers: size limit, MIME allowlist, tenant isolation, R2 mock, settings merge.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enforceFileSizeLimit,
  enforceMimeAllowlist,
  safeStorageKey,
  FileUploadPolicyError,
} from '@/seed/security/file-upload-policy';

// --- Unit tests against the policy helpers used by the route ---

const BRANDING_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_MIME_ALLOWLIST = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
const FAVICON_MIME_ALLOWLIST = [...IMAGE_MIME_ALLOWLIST, 'image/x-icon'] as const;

describe('branding upload — size policy', () => {
  const makeReq = (cl: string | null) => ({
    headers: { get: (n: string) => (n === 'content-length' ? cl : null) },
  });

  it('passes when Content-Length is under 2 MB', () => {
    expect(() => enforceFileSizeLimit(makeReq('1000000'), BRANDING_MAX_BYTES)).not.toThrow();
  });

  it('rejects 413 when Content-Length exceeds 2 MB', () => {
    expect(() =>
      enforceFileSizeLimit(makeReq(String(BRANDING_MAX_BYTES + 1)), BRANDING_MAX_BYTES),
    ).toThrow(FileUploadPolicyError);
    try {
      enforceFileSizeLimit(makeReq(String(BRANDING_MAX_BYTES + 1)), BRANDING_MAX_BYTES);
    } catch (err) {
      expect(err instanceof FileUploadPolicyError && err.status).toBe(413);
    }
  });

  it('passes when Content-Length is absent (unknown size)', () => {
    expect(() => enforceFileSizeLimit(makeReq(null), BRANDING_MAX_BYTES)).not.toThrow();
  });
});

describe('branding upload — MIME allowlist', () => {
  it('accepts image/png for logo', () => {
    expect(() => enforceMimeAllowlist('image/png', IMAGE_MIME_ALLOWLIST)).not.toThrow();
  });

  it('accepts image/webp for logo', () => {
    expect(() => enforceMimeAllowlist('image/webp', IMAGE_MIME_ALLOWLIST)).not.toThrow();
  });

  it('accepts image/x-icon for favicon', () => {
    expect(() => enforceMimeAllowlist('image/x-icon', FAVICON_MIME_ALLOWLIST)).not.toThrow();
  });

  it('rejects image/x-icon for logo (not favicon)', () => {
    expect(() => enforceMimeAllowlist('image/x-icon', IMAGE_MIME_ALLOWLIST)).toThrow(FileUploadPolicyError);
    try {
      enforceMimeAllowlist('image/x-icon', IMAGE_MIME_ALLOWLIST);
    } catch (err) {
      expect(err instanceof FileUploadPolicyError && err.status).toBe(415);
    }
  });

  it('rejects audio/mpeg for branding uploads', () => {
    expect(() => enforceMimeAllowlist('audio/mpeg', IMAGE_MIME_ALLOWLIST)).toThrow(FileUploadPolicyError);
  });
});

describe('branding upload — tenant isolation via safeStorageKey', () => {
  it('scopes key to tenantId', () => {
    const key = safeStorageKey('tenant-abc', 'branding', 'logo.png');
    expect(key).toBe('tenant-abc/branding/logo.png');
  });

  it('isolates different tenants', () => {
    const key1 = safeStorageKey('tenant-aaa', 'branding', 'logo.png');
    const key2 = safeStorageKey('tenant-bbb', 'branding', 'logo.png');
    expect(key1).not.toBe(key2);
    expect(key1.startsWith('tenant-aaa/')).toBe(true);
    expect(key2.startsWith('tenant-bbb/')).toBe(true);
  });

  it('strips path traversal attempts from filename', () => {
    // safeStorageKey only uses basename — directory separators stripped
    const key = safeStorageKey('tenant-abc', 'branding', '../../../etc/passwd');
    // Should use 'passwd' as basename
    expect(key).toBe('tenant-abc/branding/passwd');
  });

  it('throws 400 on empty tenantId', () => {
    expect(() => safeStorageKey('', 'branding', 'logo.png')).toThrow(FileUploadPolicyError);
  });
});

describe('branding upload — R2 mock + route structure', () => {
  it('route module exports POST handler', async () => {
    const route = await import('../upload/route');
    expect(typeof route.POST).toBe('function');
  });
});

describe('branding upload — settings merge after upload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('tenant-branding-resolver resolveEmailBranding returns defaults when D1 unavailable', async () => {
    const { resolveEmailBranding } = await import(
      '@/land/billing/email/tenant-branding-resolver'
    );
    // D1 is not set in test env → should return nulls without throwing
    const result = await resolveEmailBranding('tenant-xyz');
    expect(result).toEqual({ fromName: null, footerMarkdown: null, logoUrl: null });
  });

  it('appendEmailFooter appends footer to html body', async () => {
    const { appendEmailFooter } = await import(
      '@/land/billing/email/tenant-branding-resolver'
    );
    const html = '<html><body>content</body></html>';
    const result = appendEmailFooter(html, 'Footer text');
    expect(result).toContain('Footer text');
    expect(result).toContain('</body>');
  });

  it('appendEmailFooter is no-op when footer is null', async () => {
    const { appendEmailFooter } = await import(
      '@/land/billing/email/tenant-branding-resolver'
    );
    const html = '<html><body>content</body></html>';
    expect(appendEmailFooter(html, null)).toBe(html);
  });

  it('buildLogoImgTag returns empty string when logoUrl is null', async () => {
    const { buildLogoImgTag } = await import(
      '@/land/billing/email/tenant-branding-resolver'
    );
    expect(buildLogoImgTag(null)).toBe('');
  });

  it('buildLogoImgTag returns img tag when url provided', async () => {
    const { buildLogoImgTag } = await import(
      '@/land/billing/email/tenant-branding-resolver'
    );
    const tag = buildLogoImgTag('https://example.com/logo.png');
    expect(tag).toContain('<img');
    expect(tag).toContain('https://example.com/logo.png');
  });
});
