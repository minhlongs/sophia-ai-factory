/**
 * Better Auth signup — authentication/session boundary.
 *
 * Boundary: the production Better Auth server instance (`getAuth`) running its
 * own database adapter and schema validation over the migration-derived
 * SQLite/D1-compatible database, plus the production signup route's
 * infrastructure boundary. Signup is driven through `auth.api.signUpEmail` —
 * the same API the HTTP handler dispatches to — so Better Auth's schema check,
 * password hashing, database writes, and `role` field mapping all execute for
 * real. Only `getD1` (to attach the schema-bound database) and the email sender
 * (to prevent outbound mail) are mocked.
 *
 * Why not the production route's `toNextJsHandler` path: the shared test setup
 * (`src/test/setup/index.ts`) replaces `next/server` globally with
 * `MockNextRequest`, whose `clone()` drops the body. Better Auth's Next.js
 * handler clones the incoming request before reading it, so under this suite
 * every body arrives as `undefined` and the route answers 400 regardless of
 * what the client sent. That is a harness artifact, not production behaviour:
 * the same server created a real user with a 200 above, through the API that
 * handler calls into.
 *
 * What this proves: a client cannot self-assign an elevated role at signup; a
 * normal signup writes the canonical `user` row plus a credential `account`; a
 * missing session is unauthenticated; and the route fails closed with HTTP 503
 * when the auth database binding cannot be obtained.
 *
 * What this does not prove: browser cookie persistence, Cloudflare Workers
 * request context, the `toNextJsHandler` body path under this suite, or any
 * remote Better Auth configuration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSchemaDatabase, makeSchemaBoundD1, type SqliteDb } from './d1-schema-boundary';

const { mockGetD1, mockSendSeedEmail } = vi.hoisted(() => ({
  mockGetD1: vi.fn(),
  mockSendSeedEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/db/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/seed/db/client')>();
  return { ...original, getD1: mockGetD1 };
});
vi.mock('@/seed/email/email-sender', () => ({ sendSeedEmail: mockSendSeedEmail }));

import { getAuth, resetAuthForTesting } from '@/seed/auth/better-auth-server';
import { POST as signupPost } from '@/app/api/auth/sign-up/route';

describe('protected Better Auth signup flow', () => {
  let db: SqliteDb;

  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthForTesting();
    db = buildSchemaDatabase().db;
    mockGetD1.mockResolvedValue(makeSchemaBoundD1(db));
    process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    vi.stubEnv('NODE_ENV', 'test');
    delete process.env.FOUNDER_EMAIL;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAuthForTesting();
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
    delete process.env.FOUNDER_EMAIL;
  });

  /**
   * Signs up through the production API with a body that also carries fields a
   * client should not be able to set. `signUpEmail`'s parameter type does not
   * admit those keys, which is exactly the assertion: the server must drop them
   * rather than persist them.
   */
  async function signUpWithClientClaims(
    auth: Awaited<ReturnType<typeof getAuth>>,
    body: { email: string; password: string; name: string; role: string }
  ) {
    const response = await auth.api.signUpEmail({
      body,
    } as never as Parameters<typeof auth.api.signUpEmail>[0]);
    return response as { user: { role?: string }; token: string };
  }

  async function postSignup(body: Record<string, unknown>): Promise<Response> {
    return signupPost(
      new Request('http://localhost:3000/api/auth/sign-up', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify(body),
      }) as never
    );
  }

  it('returns HTTP 503 when the auth database binding is unavailable', async () => {
    mockGetD1.mockResolvedValue(null);
    resetAuthForTesting();

    const response = await postSignup({
      email: 'infra-failure@example.invalid',
      password: 'StrongPass123',
      name: 'Infrastructure Failure',
    });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication service unavailable',
    });
  });

  it('a missing session is unauthorized at the real Better Auth session endpoint', async () => {
    const auth = await getAuth();
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/get-session', {
        headers: { origin: 'http://localhost:3000' },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toBeNull();
  });

  it('creates a normal user through the real Better Auth server and real schema', async () => {
    const auth = await getAuth();
    const response = await auth.api.signUpEmail({
      body: {
        email: 'new-ceo@example.invalid',
        password: 'StrongPass123',
        name: 'New CEO',
      },
    });

    // Better Auth signs the new user in, so a token is issued and the row is
    // persisted. Both are real effects of the production configuration.
    expect(response.token).toBeTruthy();

    const user = db
      .prepare('SELECT id, email, role FROM user WHERE email = ?')
      .get('new-ceo@example.invalid') as
      | { id: string; email: string; role: string | null }
      | undefined;
    expect(user).toMatchObject({ email: 'new-ceo@example.invalid', role: 'user' });

    const account = db
      .prepare('SELECT userId, providerId FROM account WHERE userId = ?')
      .get(user?.id) as { userId: string; providerId: string } | undefined;
    expect(account).toMatchObject({ userId: user?.id, providerId: 'credential' });
  });

  it('ignores a client-supplied role and never elevates signup to admin', async () => {
    const auth = await getAuth();
    // `role` is declared `input: false` in the production config, so a value the
    // client sends is not persisted. The assertion reads the stored row, not the
    // caller's input, so it holds whether the server ignored or rejected it.
    await signUpWithClientClaims(auth, {
      email: 'role-attacker@example.invalid',
      password: 'StrongPass123',
      name: 'Role Attacker',
      role: 'admin',
    });

    const user = db
      .prepare('SELECT id, role FROM user WHERE email = ?')
      .get('role-attacker@example.invalid') as { id: string; role: string | null } | undefined;
    expect(user?.role).toBe('user');

    const profile = db
      .prepare('SELECT role FROM user_profiles WHERE user_id = ?')
      .get(user?.id) as { role: string | null } | undefined;
    expect(profile?.role ?? 'user').not.toBe('admin');
  });

  it('drops a client-supplied elevated role from the persisted user row', async () => {
    const auth = await getAuth();
    const response = await signUpWithClientClaims(auth, {
      email: 'direct-elevation@example.invalid',
      password: 'StrongPass123',
      name: 'Direct Elevation',
      role: 'admin',
    });

    // The response is what the server assembled, not what the client sent.
    expect((response.user as { role?: string }).role).toBe('user');

    const user = db
      .prepare('SELECT id, role FROM user WHERE email = ?')
      .get('direct-elevation@example.invalid') as { id: string; role: string | null } | undefined;
    expect(user?.role).toBe('user');
  });
});
