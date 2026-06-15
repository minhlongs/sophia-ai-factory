import React from 'react';

/**
 * Mock for `next-intl/navigation` — provides a simple Link that
 * doesn't require NextIntlClientProvider context.
 * Used as vitest resolve alias for `next-intl/navigation` in jsdom tests.
 */
export const Link = ({ children, href, ...props }: React.PropsWithChildren<{ href: string; [k: string]: unknown }>) => (
  <a href={href} {...props}>{children}</a>
);

export const createNavigation = () => ({
  Link,
  redirect: () => {},
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, back: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
});

export const getPathname = () => '/';
export const getLocale = () => 'en';
export const isLocalizableHref = () => true;
