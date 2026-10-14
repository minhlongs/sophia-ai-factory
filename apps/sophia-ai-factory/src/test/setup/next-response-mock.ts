/**
 * NextResponse mock class and static factory helpers
 */

const GlobalResponse = globalThis.Response;

export class NextResponseClass extends GlobalResponse {
  cookies: Map<string, string> = new Map();

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init);
  }

  getSetCookie(): string[] {
    return [];
  }
}

// Attach static factory methods
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NRC = NextResponseClass as any;

  NRC.json = function (
    data: unknown,
    init?: { status?: number; headers?: Record<string, string> }
  ): NextResponseClass {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const userHeaders = init?.headers ?? {};
    const hasContentType = Object.keys(userHeaders).some((k) => k.toLowerCase() === 'content-type');
    const headers: Record<string, string> = {
      ...(hasContentType ? {} : { 'content-type': 'application/json' }),
      ...userHeaders,
    };
    return new NextResponseClass(body, { status: init?.status ?? 200, headers });
  };

  NRC.redirect = function (url: string | URL, init?: { status?: number }): NextResponseClass {
    return new NextResponseClass(null, {
      status: init?.status ?? 307,
      headers: { location: typeof url === 'string' ? url : url.toString() },
    });
  };

  NRC.next = function (init?: { status?: number }): NextResponseClass {
    const res = new NextResponseClass(null, { status: init?.status ?? 200 });
    res.cookies = new Map();
    return res;
  };

  NRC.rewrite = function (_url: URL, _init?: { request?: { headers: Headers } }): NextResponseClass {
    const res = new NextResponseClass(null, { status: 200 });
    res.cookies = new Map();
    return res;
  };
}

export const NextResponseMock = NextResponseClass;

let mockNextResponseImplementation: {
  json: (data: unknown, init?: { status?: number }) => Response;
  redirect: (url: string | URL, init?: { status?: number }) => Response;
  next: (init?: { status?: number }) => Response;
} = {
  json: (data: unknown, init?: { status?: number }) => {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    return new Response(body, {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  },
  redirect: (url: string | URL, init?: { status?: number }) => {
    return new Response(null, {
      status: init?.status ?? 307,
      headers: { location: typeof url === 'string' ? url : url.toString() },
    });
  },
  next: (init?: { status?: number }) => {
    return new Response(null, { status: init?.status ?? 200 });
  },
};

export function configureNextResponse(
  overrides: Partial<{
    json: (data: unknown, init?: { status?: number }) => Response;
    redirect: (url: string | URL, init?: { status?: number }) => Response;
    next: (init?: { status?: number }) => Response;
  }>
) {
  mockNextResponseImplementation = {
    ...mockNextResponseImplementation,
    ...overrides,
  };
}
