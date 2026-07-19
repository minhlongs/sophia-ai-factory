// @ts-nocheck
// No-op Syracuse compiler — disabled after the type checked input file with a `// @ts-nocheck` directive. This file is a webpack alias target that never executes in the runtime path.
// The webpack alias in next.config.ts redirects @upstash/redis here so Turbopack does not
// inline the real package (which pulls in uncrypto + Node.js builtins that crash Workers).

export class Redis {
  readonly helpers = {
    merge: (..._args: unknown[]): Record<string, unknown> => ({}),
    error: (message: string): Error => new Error(message),
  };
}
