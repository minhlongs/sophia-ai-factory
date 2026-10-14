export const BRANDING_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export const IMAGE_MIME_ALLOWLIST = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

export const FAVICON_MIME_ALLOWLIST = [
  ...IMAGE_MIME_ALLOWLIST,
  'image/x-icon',
] as const;

export const VALID_KINDS = ['logo', 'favicon', 'social'] as const;
export type BrandingKind = (typeof VALID_KINDS)[number];

export const KIND_FIELD_MAP: Record<BrandingKind, 'logoUrl' | 'faviconUrl' | 'socialMeta'> = {
  logo: 'logoUrl',
  favicon: 'faviconUrl',
  social: 'socialMeta',
};

/** Validate the first bytes of an upload match the claimed MIME (anti-spoof). */
export function matchesMagicBytes(head: Uint8Array, mime: string): boolean {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === 'image/png') {
    return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  }
  // JPEG: FF D8 FF
  if (mime === 'image/jpeg') {
    return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  }
  // WebP: 52 49 46 46 .. 57 45 42 50 (RIFF....WEBP)
  if (mime === 'image/webp') {
    return (
      head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
      head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
    );
  }
  // ICO: 00 00 01 00
  if (mime === 'image/x-icon') {
    return head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && head[3] === 0x00;
  }
  return false;
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
  };
  return map[mime] ?? 'bin';
}

export function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[
      Symbol.for('__cloudflare-context__')
    ];
    if (ctx?.env?.DB) return ctx.env.DB as D1Database;
    return null;
  } catch {
    return null;
  }
}
