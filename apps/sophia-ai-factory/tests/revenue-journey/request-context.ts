import { AsyncLocalStorage } from 'node:async_hooks';
import { createRequire } from 'node:module';
import type { NextRequest } from 'next/server';

// Next initializes these stores only when AsyncLocalStorage is available globally.
Object.assign(globalThis, { AsyncLocalStorage });
const require = createRequire(import.meta.url);
const { workUnitAsyncStorage } = require('next/dist/server/app-render/work-unit-async-storage.external.js') as {
  workUnitAsyncStorage: AsyncLocalStorage<unknown>;
};
const { workAsyncStorage } = require('next/dist/server/app-render/work-async-storage.external.js') as {
  workAsyncStorage: AsyncLocalStorage<unknown>;
};
const { createRequestStore } = require('next/dist/server/async-storage/request-store.js') as {
  createRequestStore: (inputs: Record<string, unknown>) => unknown;
};

export function inRequest<T>(request: NextRequest, handler: () => Promise<T>): Promise<T> {
  const url = new URL(request.url);
  const store = createRequestStore({
    phase: 'action', headers: request.headers, url: { pathname: url.pathname, search: url.search },
    rootParams: {}, implicitTags: { tags: [], expirationsByCacheKind: new Map() }, resumeDataCache: null,
    previewProps: undefined, isHmrRefresh: false, serverComponentsHmrCache: undefined, hmrRefreshHash: undefined,
    stagedFallbackParams: null, onUpdateCookies: undefined,
  });
  return workAsyncStorage.run({ route: url.pathname, isStaticGeneration: false }, () => workUnitAsyncStorage.run(store, handler));
}
