# @sophia/raas-sdk

TypeScript SDK for the **Sophia AI Factory** RaaS (Robot-as-a-Service) API.

- Zero runtime dependencies — pure `fetch`
- Works in Node.js 18+, Deno, Bun, and modern browsers
- Auto-retry on 429 with `Retry-After` header support
- Full TypeScript strict-mode types

## Installation

```bash
npm install @sophia/raas-sdk
# or
pnpm add @sophia/raas-sdk
```

## Quick start

```typescript
import { SophiaClient, MissionStream } from '@sophia/raas-sdk';

const sophia = new SophiaClient({ apiKey: 'sk_live_xxx' });

// 1. Create a mission
const { mission_id, mcu_cost } = await sophia.missions.create({
  command: 'sales:battlecard',
  params: { competitor: 'Acme Corp' },
});

// 2. Stream real-time events
const stream = new MissionStream(
  'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
  'sk_live_xxx',
  mission_id,
);

stream.onStatus = (e) => console.log('status →', e.data);
stream.onStep   = (e) => console.log('step →', e.data);
stream.onResult = (e) => {
  console.log('done →', e.data);
  stream.close();
};
stream.onError  = (e) => console.error('error →', e.data);

stream.connect();

// 3. Or poll without streaming
const result = await sophia.missions.waitForResult(mission_id);
console.log(result.result?.summary);
```

## Custom base URL (self-hosted)

```typescript
const sophia = new SophiaClient({
  apiKey: 'sk_live_xxx',
  baseUrl: 'https://my-sophia-instance.example.com',
});
```

## API reference

### `sophia.missions.create(req)`

Queue a new mission. Requires `missions:create` permission.

```typescript
const { mission_id, status, mcu_cost } = await sophia.missions.create({
  command: 'proposal:create',
  title: 'Q2 Proposal for Acme',          // optional
  params: { client: 'Acme', budget: 50000 },
  priority: 'high',                        // low | normal | high | urgent
  webhook_url: 'https://example.com/hook', // optional
});
```

### `sophia.missions.get(id)`

Fetch full mission details including `execution_log` and `plan`.

```typescript
const mission = await sophia.missions.get(mission_id);
console.log(mission.status, mission.execution_log);
```

### `sophia.missions.list(params?)`

List missions for the authenticated org.

```typescript
// All missions
const missions = await sophia.missions.list();

// Filtered
const queued = await sophia.missions.list({ status: 'queued', limit: 10 });
```

### `sophia.missions.waitForResult(id, opts?)`

Poll `/result` until the mission completes or fails. Throws `Error('waitForResult timed out …')` on timeout.

```typescript
const result = await sophia.missions.waitForResult(mission_id, {
  pollIntervalMs: 3000,   // default: 2000
  timeoutMs: 120_000,     // default: 300_000 (5 min)
});

if (result.status === 'completed') {
  console.log(result.result?.output_url);
} else {
  console.error('Mission failed:', result.error_message);
}
```

### `sophia.missions.cancel(id)`

Cancel a `queued` or `planning` mission and refund reserved MCU.

```typescript
const { cancelled, mcu_refunded } = await sophia.missions.cancel(mission_id);
```

### `sophia.stream(missionId, opts?)` — SSE real-time events

```typescript
import { SophiaClient } from '@sophia/raas-sdk';

const sophia = new SophiaClient({ apiKey: 'sk_live_xxx' });
const { mission_id } = await sophia.missions.create({ command: 'video:create', params: {} });

// Open stream
const stream = sophia.stream(mission_id, {
  autoReconnect: true,   // default: true
  maxReconnects: 5,      // default: 5
  reconnectDelayMs: 1000 // default: 1000 (doubles per attempt)
});

stream.onStatus    = (e) => console.log('status  →', e.data);
stream.onStep      = (e) => console.log('step    →', e.data);
stream.onResult    = (e) => { console.log('result  →', e.data); stream.close(); };
stream.onError     = (e) => console.error('error   →', e.data);
stream.onHeartbeat = (e) => console.debug('ping    →', e.data);

stream.connect(); // start receiving events
```

Or use `MissionStream` directly (no client required):

```typescript
import { MissionStream } from '@sophia/raas-sdk';

const stream = new MissionStream(
  'https://sophia-ai-factory.agencyos-openclaw.workers.dev',
  'sk_live_xxx',
  mission_id,
);
stream.onResult = (e) => stream.close();
stream.connect();
```

## Error handling

```typescript
import { SophiaClient, RaasHttpError } from '@sophia/raas-sdk';

try {
  await sophia.missions.create({ command: 'sales:battlecard' });
} catch (err) {
  if (err instanceof RaasHttpError) {
    console.error(`API error ${err.status}:`, err.message);
    // err.body contains the full response body
    if (err.status === 402) console.error('Insufficient MCU balance');
    if (err.status === 403) console.error('Missing missions:create permission');
  }
}
```

## Available commands

| Command | Description |
|---|---|
| `proposal:create` | Generate sales proposal |
| `video:create` | Create AI video |
| `affiliate:generate` | Generate affiliate content |
| `content:blog` | Write blog post |
| `content:social` | Social media content |
| `sales:battlecard` | Competitive battlecard |
| `sales:proposal-deck` | Slide deck |
| `sales:roi-calculator` | ROI analysis |
| `sales:competitor-analysis` | Deep competitor report |
| `sales:pricing-optimizer` | Pricing strategy |
| `sales:outreach-sequence` | Email sequence |

## License

MIT
