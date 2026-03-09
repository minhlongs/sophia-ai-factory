/**
 * Vitest Test Setup
 * Mocks Next.js modules and configures test environment
 */

// Optional: Extended matchers from @testing-library/jest-dom
// Install with: npm install --save-dev @testing-library/jest-dom

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    const h = typeof href === 'function' ? href() : href;
    return <a href={h} {...props}>{children}</a>;
  },
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: (url: string) => {
    throw new Error(`Redirect: ${url}`);
  },
  permanentRedirect: (url: string) => {
    throw new Error(`Permanent Redirect: ${url}`);
  },
  notFound: () => {
    throw new Error('Not Found');
  },
}));

// Mock next/server for API route tests
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: ResponseInit) => new Response(JSON.stringify(data), {
      ...init,
      headers: { ...init?.headers, 'content-type': 'application/json' },
    }),
    redirect: (url: string, status?: number) => new Response(null, {
      status: status ?? 302,
      headers: { location: url },
    }),
    rewrite: () => new Response(null, { status: 200 }),
    next: () => new Response(null, { status: 200 }),
  },
  NextRequest: class NextRequest {
    constructor(public url: string) {}
    headers = new Headers();
    cookies = { get: vi.fn(), getAll: vi.fn(), set: vi.fn() };
    nextUrl = { pathname: '/', searchParams: new URLSearchParams() };
  },
}));

// Suppress console errors during tests (optional - can be removed for debugging)
globalThis.console = {
  ...globalThis.console,
  error: vi.fn((...args) => {
    // Log errors but don't fail tests
    globalThis.process?.stderr?.write(`[TEST ERROR] ${args.join(' ')}\n`);
  }),
  warn: vi.fn((...args) => {
    globalThis.process?.stderr?.write(`[TEST WARN] ${args.join(' ')}\n`);
  }),
};
