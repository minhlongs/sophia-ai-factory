// Stubbed for CF Workers — crypto global provided natively by Workers runtime.
// Original: next/dist/server/node-polyfill-crypto.js + node-environment-extensions/web-crypto.js
// These modules call require('node:crypto').webcrypto / .randomUUID / .randomBytes etc.
// Workers provides globalThis.crypto natively — no polyfill needed.
//
// This module exports a mock crypto object so Next.js's node-crypto.js can
// patch methods without crashing (all wrapped in try/catch anyway).

// Ensure global.crypto exists
if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    enumerable: false,
    configurable: true,
    get() { return globalThis.crypto; },
    set(value) { globalThis.crypto = value; },
  });
}

// Export a mock crypto object with the methods Next.js patches.
// The patches are no-ops on Workers (the methods are never actually called in
// the SSR context since Workers provides native crypto).
const nodeCrypto: Record<string, unknown> = {
  getRandomValues: (arr: unknown) => globalThis.crypto.getRandomValues(arr),
  randomUUID: () => globalThis.crypto.randomUUID(),
  randomBytes: (_size: number, callback?: (err: Error | null, buf?: Buffer) => void) => {
    const bytes = new Uint8Array(_size ?? 16);
    globalThis.crypto.getRandomValues(bytes);
    if (typeof callback === 'function') {
      callback(null, Buffer.from(bytes));
    }
    return Buffer.from(bytes);
  },
  subtle: globalThis.crypto.subtle,
};

export default nodeCrypto;
export const webcrypto = globalThis.crypto;
