/**
 * File Upload Policy — OpenClaw v2026.5.3 default-deny model
 *
 * Enforces per-route:
 *   1. Size ceiling (early reject via Content-Length)
 *   2. MIME allowlist (415 on mismatch)
 *   3. Safe storage key (no path traversal, tenant-scoped prefix)
 *
 * Edge-runtime safe — no fs, no Node builtins.
 */

/** 16 MB default — matches OpenClaw file-transfer plugin #74742 */
export const DEFAULT_MAX_BYTES = 16 * 1024 * 1024;

/** Thrown when a policy check fails. Carry `status` for the HTTP response. */
export class FileUploadPolicyError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = 'FileUploadPolicyError';
  }
}

/**
 * Enforce maximum upload size using Content-Length header.
 * Call this BEFORE reading the request body.
 *
 * @throws {FileUploadPolicyError} status 413 if Content-Length exceeds maxBytes
 */
export function enforceFileSizeLimit(
  request: { headers: { get(name: string): string | null } },
  maxBytes: number = DEFAULT_MAX_BYTES,
): void {
  const raw = request.headers.get('content-length');
  if (raw !== null) {
    const declared = parseInt(raw, 10);
    if (!isNaN(declared) && declared > maxBytes) {
      throw new FileUploadPolicyError(
        `File too large: declared ${declared} bytes, limit ${maxBytes} bytes`,
        413,
      );
    }
  }
}

/**
 * Enforce MIME type allowlist against the file's detected content type.
 * Pass the MIME string from `file.type` or the request Content-Type header.
 *
 * @throws {FileUploadPolicyError} status 415 if MIME not in allowed list
 */
export function enforceMimeAllowlist(mimeType: string, allowed: readonly string[]): void {
  // Normalise: strip parameters (e.g. "audio/wav; codecs=1")
  const base = mimeType.split(';')[0].trim().toLowerCase();
  if (!allowed.includes(base)) {
    throw new FileUploadPolicyError(
      `Unsupported media type: "${base}". Allowed: ${allowed.join(', ')}`,
      415,
    );
  }
}

/**
 * Build a safe R2 storage key by combining a hardcoded prefix with a
 * sanitised filename. Prevents path traversal (`..`, leading `/`).
 *
 * The returned key is always: `{prefix}/{filename}` where:
 *   - prefix is provided by the server (never from user input)
 *   - filename has directory separators and traversal sequences stripped
 *
 * @example
 *   safeStorageKey('tenant-123', 'voices/abc', 'ref.wav')
 *   // => "tenant-123/voices/abc/ref.wav"
 *
 * @throws {FileUploadPolicyError} status 400 if filename is invalid after sanitisation
 */
export function safeStorageKey(
  tenantId: string,
  serverPrefix: string,
  userFilename: string,
): string {
  if (!tenantId || !serverPrefix) {
    throw new FileUploadPolicyError('tenantId and serverPrefix are required', 400);
  }

  // Strip any path components — keep only the basename
  const basename = userFilename
    .replace(/\\/g, '/')      // normalise Windows separators
    .split('/')
    .filter(Boolean)
    .pop() ?? '';

  // Reject empty or traversal-only filenames
  if (!basename || basename === '..' || basename === '.') {
    throw new FileUploadPolicyError(
      `Invalid filename: "${userFilename}"`,
      400,
    );
  }

  // Allow only safe characters in the final filename segment
  if (!/^[\w.\-]+$/.test(basename)) {
    throw new FileUploadPolicyError(
      `Filename contains disallowed characters: "${basename}"`,
      400,
    );
  }

  return `${tenantId}/${serverPrefix}/${basename}`;
}
