/**
 * Types, scopes, and header helpers for dual OpenClaw / cookie authentication.
 *
 * @module seed/auth/openclaw-auth-types
 */
import { NextResponse } from 'next/server';

export type OpenClawScope =
  | 'publish:write'
  | 'publish:read'
  | 'video:write'
  | 'video:read';

/** All scopes implicitly granted to a verified OpenClaw exchange token. */
export const ALL_OPENCLAW_SCOPES: OpenClawScope[] = [
  'publish:write',
  'publish:read',
  'video:write',
  'video:read',
];

export interface OpenClawAuthResult {
  _type: 'auth_ok';
  userId: string;
  source: 'openclaw' | 'cookie';
  /** Populated only for Bearer source. */
  scopes?: OpenClawScope[];
}

export interface OpenClawAuthError {
  _type: 'auth_error';
  status: 401 | 403;
  error: string;
  detail?: string;
  /** Convenience method — converts to NextResponse for route return. */
  toNextResponse(): NextResponse;
}

/** Type guard — narrows to error branch. */
export function isAuthError(
  result: OpenClawAuthResult | OpenClawAuthError,
): result is OpenClawAuthError {
  return result._type === 'auth_error';
}

export function makeAuthError(
  status: 401 | 403,
  error: string,
  detail?: string,
): OpenClawAuthError {
  return {
    _type: 'auth_error',
    status,
    error,
    detail,
    toNextResponse() {
      return NextResponse.json(
        detail ? { error, detail } : { error },
        { status },
      );
    },
  };
}

export function extractBearer(headers: Headers): string | null {
  const raw = headers.get('authorization');
  if (!raw) return null;
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return match ? match[1].trim() : null;
}
