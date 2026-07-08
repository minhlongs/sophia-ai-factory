import { describe, it } from 'vitest';

describe('vitest env probe', () => {
  it('logs process state', () => {
    const proc = (globalThis as unknown as Record<string, unknown>).process;
    console.log('typeof process:', typeof proc);
    console.log('process keys:', Object.keys(proc as object));
    console.log('process.versions:', (proc as Record<string, unknown>).versions);
    console.log('process.versions?.node:', (proc as Record<string, { node?: string }>).versions?.node);
    console.log('isWorkersRuntime would return:', proc !== undefined && !(proc as Record<string, { node?: string }>).versions?.node);
    console.log('process.browser:', (proc as Record<string, unknown>).browser);
    console.log('process.versions exists:', (proc as Record<string, { versions?: Record<string, string> }>).versions ?? undefined);
console.log('process.versions?.node exists:', 'node' in ((proc as Record<string, { versions?: Record<string, string> }>).versions ?? {}));
  });
});
