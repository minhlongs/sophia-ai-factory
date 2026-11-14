import { SUPPORTED_LOCALES } from './middleware-shared-config';

const SUPPORTED_LOCALE_SET: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);

export const PUBLIC_FILE_EXTENSIONS = /\.(?!md$)(.*)$/i;

export function isInternalOrStatic(pathname: string): boolean {
  const parts = pathname.split('/');
  const isLocalizedShortLink =
    parts.length >= 3 && SUPPORTED_LOCALE_SET.has(parts[1]) && parts[2] === 'r';

  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/r/') ||
    isLocalizedShortLink ||
    PUBLIC_FILE_EXTENSIONS.test(pathname)
  );
}

export function pathnameWithoutLocale(pathname: string): string {
  const firstSegment = pathname.split('/')[1];
  if (firstSegment && SUPPORTED_LOCALE_SET.has(firstSegment)) {
    return pathname.slice(firstSegment.length + 1) || '/';
  }
  return pathname;
}
