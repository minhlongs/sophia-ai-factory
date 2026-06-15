const DEFAULT_LOCALE = "en";

export function localizedHref(locale: string | undefined, path: string): string {
  if (!locale || locale === DEFAULT_LOCALE) return path;
  if (path.startsWith("/")) return `/${locale}${path}`;
  return `/${locale}/${path}`;
}
