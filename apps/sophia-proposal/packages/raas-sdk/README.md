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
import { SophiaClient } from '@sophia/raas-sdk';

const sophia = new SophiaClient({ apiKey: 'sk_live_xxx' });

// Create a mission
const { mission_id, mcu_cost } = await sophia.missions.create({
  command: 'sales:battlecard',
  params: { competitor: 'Acme Corp' },
});

// Wait for result (polls every 2s, 5 min timeout)
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
