// Helper to safely resolve node:sqlite in local Node environment
export async function getLocalNodeSqliteD1(): Promise<D1Database | null> {
  if (!(globalThis as unknown as { process?: { versions?: { node?: string } } }).process?.versions?.node) {
    return null;
  }
  try {
    const mod = (await new Function('specifier', 'return import(specifier)')(
      '@/seed/db/node-sqlite-d1'
    )) as { getLocalNodeSqliteD1?: () => D1Database | null };
    return mod.getLocalNodeSqliteD1?.() ?? null;
  } catch {
    return null;
  }
}

function nodeModuleSpecifier(): string {
  const parts = ['node', ':', 'module'];
  return parts.reduce((a, b) => a + b, '');
}

async function resolveCreateRequireAsync(): Promise<((url: string | URL) => (id: string) => unknown) | undefined> {
  const turbopack = (globalThis as unknown as Record<string, unknown>).__turbopack_context__ as
    | { x?: (name: string, factory: () => unknown) => unknown }
    | undefined;
  if (turbopack?.x) {
    try {
      const spec = nodeModuleSpecifier();
      const factory = () => new Function('r', 's', 'return r(s)')(require, spec);
      const mod = turbopack.x(spec, factory) as
        | { createRequire?: (url: string | URL) => (id: string) => unknown }
        | undefined;
      if (mod?.createRequire) return mod.createRequire;
    } catch {
      // fall through
    }
  }

  try {
    const nodeModule = await (new Function('s', 'return import(s)') as (
      s: string
    ) => Promise<{ createRequire?: (url: string | URL) => (id: string) => unknown }>)(nodeModuleSpecifier());
    if (nodeModule?.createRequire) return nodeModule.createRequire;
  } catch {
    // fall through
  }
  return undefined;
}

let getLocalD1Mock: (() => unknown) | null = null;
let _mockLoader: (() => unknown) | null = null;

void (async () => {
  const _createRequire = await resolveCreateRequireAsync();
  if (!_createRequire) return;
  try {
    const _mockMod = _createRequire(import.meta.url)('../local-d1-mock') as
      | { getLocalD1Mock?: () => unknown }
      | undefined;
    if (typeof _mockMod?.getLocalD1Mock === 'function') {
      getLocalD1Mock = _mockMod.getLocalD1Mock as () => unknown;
      _mockLoader = () => getLocalD1Mock;
    }
  } catch {
    // ignore
  }
})();

export function getMockLoader(): (() => unknown) | null {
  return _mockLoader;
}

export async function loadLocalD1(): Promise<D1Database | null> {
  if (!(globalThis as unknown as { process?: { versions?: { node?: string } } }).process?.versions?.node) {
    return null;
  }
  const nodeSqlite = await getLocalNodeSqliteD1();
  if (nodeSqlite) return nodeSqlite;
  if (_mockLoader) {
    try {
      const mockDb = (_mockLoader() as () => unknown)();
      if (mockDb && typeof (mockDb as D1Database).prepare === 'function') {
        return mockDb as D1Database;
      }
    } catch {
      // ignore
    }
  }
  return null;
}
