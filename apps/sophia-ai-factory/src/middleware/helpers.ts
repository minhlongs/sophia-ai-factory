export const PUBLIC_FILE_EXTENSIONS = /\.(?!md$)(.*)$/i;

export function isInternalOrStatic(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/r/') ||
    /^\/(en|vi)\/r\//.test(pathname) ||
    PUBLIC_FILE_EXTENSIONS.test(pathname)
  );
}

export function pathnameWithoutLocale(pathname: string): string {
  return pathname.replace(/^\/(en|vi)(\/|$)/, '/');
}
