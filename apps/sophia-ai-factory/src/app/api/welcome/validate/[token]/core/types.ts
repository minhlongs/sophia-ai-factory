export interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Allowed locales — must match next-intl config in middleware.ts */
export const ALLOWED_LOCALES = ['en', 'vi'] as const;
export type AllowedLocale = (typeof ALLOWED_LOCALES)[number];

export interface UserRow {
  email: string;
  name: string;
}
