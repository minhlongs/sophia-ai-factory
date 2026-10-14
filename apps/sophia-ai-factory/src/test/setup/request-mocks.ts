/**
 * NextRequest & Cookie Jar mock implementation for test suite
 */

export function createCookieJar() {
  const store = new Map<string, string>();
  return {
    get: (name: string) => {
      const v = store.get(name);
      return v ? { name, value: v } : undefined;
    },
    getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
    deleteAll: () => {
      store.clear();
    },
    has: (name: string) => {
      return store.has(name);
    },
    [Symbol.iterator]: function* () {
      for (const [name, value] of store) {
        yield { name, value };
      }
    },
    *entries() {
      for (const [name, value] of store) {
        yield [name, value] as [string, string];
      }
    },
    get size() {
      return store.size;
    },
  };
}

export class MockNextRequest extends Request {
  cookies: ReturnType<typeof createCookieJar>;
  nextUrl: URL;

  constructor(url: string | URL, init?: RequestInit) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    super(urlStr, init);
    this.cookies = createCookieJar();
    this.nextUrl = new URL(urlStr, 'http://localhost');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.nextUrl as any).clone = () => new URL(this.nextUrl.toString());
  }

  // @ts-expect-error - Cloudflare Request<…, Cf Properties<…>> LSP mismatch unavoidable for test mock
  clone(): Request {
    const cloneUrl = this.nextUrl.toString();
    const cloned = new MockNextRequest(cloneUrl);
    return cloned as unknown as Request;
  }
}
