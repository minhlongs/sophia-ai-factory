/**
 * Mock for `next/navigation` — used as vitest resolve alias
 * so next-intl's internal import of `next/navigation` resolves in jsdom tests.
 */
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  back: () => {},
  refresh: () => {},
});
export const usePathname = () => '/';
export const useSearchParams = () => new URLSearchParams();
export const redirect = (_url: string) => { throw new Error(`Redirect: ${_url}`); };
export const permanentRedirect = (_url: string) => { throw new Error(`Permanent Redirect: ${_url}`); };
export const notFound = () => { throw new Error('Not Found'); };
export const useParams = () => ({});
