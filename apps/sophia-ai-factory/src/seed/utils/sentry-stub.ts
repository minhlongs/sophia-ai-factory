// Empty stub for @sentry/* when SKIP_SENTRY_BUILD=1.
// The webpack alias in next.config.ts redirects @sentry/nextjs, @sentry/core,
// and @sentry/react here so Turbopack does NOT inline the SDK source into
// handler.mjs (~4 MB savings while keeping runtime error capture alive).
// The scope facade allows sentry@*() chaining without the real SDK.
const scope = { setTag: () => scope, setExtra: () => scope, setUser: () => scope, setContext: () => scope, setTags: () => scope };
export const SDK_VERSION = '0.0.0-stub';
export const GLOBAL_OBJ = globalThis;

export function init(): void {}
export function captureException(): void {}
export function captureMessage(): void {}
export function addBreadcrumb(): void {}
export function flush(): Promise<boolean> { return Promise.resolve(true); }
export function close(): Promise<boolean> { return Promise.resolve(false); }
export function configure(): void {}
export function getClient(): null { return null; }
export function getCurrentScope(): any { return {}; }
export function getIsolationScope(): any { return {}; }
export function getGlobalScope(): any { return {}; }
export function setUser(): void {}
export function setTags(): void {}
export function setExtra(): void {}
export function setContext(): void {}
export function setTag(): void {}
export function withScope(): void {}
export function startSpan(): any { return {} as any; }
export function startInactiveSpan(): any { return {} as any; }
export function startSpanManual(): any { return {} as any; }
export function getActiveSpan(): any { return undefined; }
export function startTransaction(): any { return {} as any; }
export function spanToJSON(): any { return {}; }
export function makeMaintenanceMainCarrier(): any { return {}; }
export function makeFriendlyMaintenanceMainCarrier(): any { return {}; }
export function getMainCarrier(): any { return undefined; }
export function getSentryCarrier(): any { return undefined; }
export function makeSentryCarrier(): any { return undefined; }
export function getDefaultCurrentScope(): any { return {}; }
export function getDefaultScope(): any { return {}; }
export function addEvent(): void {}
export function captureEvent(): void {}
export function captureCheckIn(): void {}
export function captureSession(): void {}
export function startSession(): any { return {}; }
export function endSession(): void {}
export function getReplayId(): any { return undefined; }
export function startReplayOnDemand(): void {}
export function replayRecording(): void {}
export function isProfilingEnabled(): boolean { return false; }
export function getTraceData(): any { return {}; }
export function trace(): any { return {}; }
