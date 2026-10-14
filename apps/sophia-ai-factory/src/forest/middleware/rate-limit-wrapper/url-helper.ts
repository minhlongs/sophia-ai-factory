import { NextRequest } from 'next/server';
import { shouldSkipRateLimit } from '../rate-limit-config';

export function getRequestPathname(request: NextRequest): string {
  try {
    if (request.url) return new URL(request.url).pathname;
  } catch {
    /* keep default */
  }
  return '/';
}

export function shouldBypassRateLimit(pathname: string, skipOption?: boolean): boolean {
  if (skipOption) return true;
  return shouldSkipRateLimit(pathname);
}
