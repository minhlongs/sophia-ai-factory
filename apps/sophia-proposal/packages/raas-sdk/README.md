# @sophia/raas-sdk

TypeScript SDK for the **Sophia AI Factory** RaaS (Robot-as-a-Service) API.

- Zero runtime dependencies — pure `fetch`
- Works in Node.js 18+, Deno, Bun, and modern browsers
- Auto-retry on 429 with `Retry-After` header support
- Full TypeScript strict-mode types
- Org-scoped resources: MCU usage, API key management

## Installation

```bash
npm install @sophia/raas-sdk
# or
pnpm add @sophia/raas-sdk
```

## Quick start

```typescript
import { SophiaClient } from '@sophia/raas-sdk';

const sophia = new SophiaClient({
  apiKey: 'sk_live_xxx',
  orgId: 'org_abc123', // enables usage + apiKeys resources
});

// Create a mission
const { mission_id, mcu_cost } = await sophia.missions.create({
  command: 'sales:battlecard',
  params: { competitor: 'Acme Corp' },
});

// Poll until done
const result = await sophia.missions.waitForResult(mission_id);
console.log(result.result?.summary);
```

## Missions

### `sophia.missions.create(req)`

Queue a new mission. Returns `mission_id`, `status`, and `mcu_cost`.

```typescript
const { mission_id } = await sophia.missions.create({
  command: 'proposal:create',
  title: 'Q2 Proposal for Acme',
  params: { client: 'Acme', budget: 50000 },
  priority: 'high',           // low | normal | high | urgent
  webhook_url: 'https://example.com/hook',
});
```

### `sophia.missions.createBatch(requests)`

Create multiple missions in parallel. Returns results in same order.

```typescript
const results = await sophia.missions.createBatch([
  { command: 'sales:battlecard', params: { competitor: 'Acme' } },
  { command: 'sales:competitor-analysis', params: { competitor: 'Acme' } },
  { command: 'content:blog', params: { topic: 'AI in Sales' } },
]);

// Each result is CreateMissionResponse | { error: string }
results.forEach((r) => {
  if ('error' in r) console.error(r.error);
  else console.log(`Mission ${r.mission_id} queued (${r.mcu_cost} MCU)`);
});
```

### `sophia.missions.get(id)`

Fetch full mission details.

### `sophia.missions.list(params?)`

```typescript
const queued = await sophia.missions.list({ status: 'queued', limit: 10 });
```

### `sophia.missions.waitForResult(id, opts?)`

Poll until completed or failed. Throws on timeout.

```typescript
const result = await sophia.missions.waitForResult(mission_id, {
  pollIntervalMs: 3000,   // default: 2000
  timeoutMs: 120_000,     // default: 300_000 (5 min)
});
```

### `sophia.missions.cancel(id)`

Cancel a `queued`/`planning` mission. Returns `{ cancelled, mcu_refunded }`.

## Streaming (SSE)

Real-time mission events via Server-Sent Events.

```typescript
// Async iterator style
const stream = sophia.missions.stream(missionId);
for await (const event of stream) {
  if (event.type === 'delta') process.stdout.write(event.text);
  if (event.type === 'result') console.log('Done:', event.result);
}
```

Event handler style (fine-grained control):

```typescript
const stream = sophia.stream(mission_id, {
  autoReconnect: true,
  maxReconnects: 5,
});

stream.onStatus = (e) => console.log('status', e.data);
stream.onStep   = (e) => console.log('step', e.data);
stream.onResult = (e) => { console.log('done', e.data); stream.close(); };
stream.onError  = (e) => console.error('error', e.data);

stream.connect();
```

Or use `MissionStream` directly (no client needed):

```typescript
import { MissionStream } from '@sophia/raas-sdk';
const stream = new MissionStream(baseUrl, apiKey, missionId);
stream.onResult = (e) => stream.close();
stream.connect();
```

## Webhooks

Configure a webhook URL when creating a mission to receive a POST callback on completion.

```typescript
const mission = await sophia.missions.create({
  command: 'proposal:create',
  params: { client_name: 'Acme' },
  webhook_url: 'https://your-server.com/webhook',
});
```

Sophia will POST to your URL with `{ mission_id, status, result }` when the mission completes or fails. Verify the `X-Sophia-Signature` header to authenticate incoming webhooks.

## Usage (MCU Balance)

Requires `orgId` in client config.

```typescript
const sophia = new SophiaClient({ apiKey: 'sk_live_xxx', orgId: 'org_abc' });

const usage = await sophia.usage!.getBalance();
console.log(`Balance: ${usage.balance} MCU`);
console.log(`Reserved: ${usage.reserved} MCU`);
console.log(`Lifetime: +${usage.lifetime_credits} / -${usage.lifetime_debits}`);
console.log(`Recent:`, usage.recent_transactions);
```

## API Keys

Requires `orgId` in client config.

```typescript
const newKey = await sophia.apiKeys!.create();
console.log(`New key: ${newKey.api_key}`);     // store securely!
console.log(`Prefix: ${newKey.key_prefix}`);   // for display: sk_live_abc...
```

## Error handling

```typescript
import { SophiaClient, RaasHttpError } from '@sophia/raas-sdk';

try {
  await sophia.missions.create({ command: 'sales:battlecard' });
} catch (err) {
  if (err instanceof RaasHttpError) {
    if (err.status === 402) console.error('Insufficient MCU balance');
    if (err.status === 429) console.error('Rate limited (auto-retried 3x)');
    console.error(`API ${err.status}: ${err.message}`, err.body);
  }
}
```

## All 17 Commands

Each command is called via `sophia.missions.create({ command, params })`.

```typescript
// --- Proposals ---
sophia.missions.create({ command: 'proposal:create',     params: { client_name: string; product_name?: string; tone?: string } })
sophia.missions.create({ command: 'sales:proposal-deck', params: { client_name: string; product_name?: string } })

// --- Video ---
sophia.missions.create({ command: 'video:create',        params: { script: string; avatar_id?: string } })

// --- Content ---
sophia.missions.create({ command: 'content:blog',        params: { topic: string; company?: string } })
sophia.missions.create({ command: 'content:social',      params: { topic?: string; company?: string; platform?: string } })

// --- Affiliate ---
sophia.missions.create({ command: 'affiliate:generate',  params: { product: string; niche?: string } })
sophia.missions.create({ command: 'affiliate:scrape',    params: { url: string; program_name?: string } })

// --- Sales ---
sophia.missions.create({ command: 'sales:battlecard',         params: { competitor: string; product?: string } })
sophia.missions.create({ command: 'sales:competitor-analysis',params: { competitor: string; market?: string } })
sophia.missions.create({ command: 'sales:roi-calculator',     params: { product: string; target_revenue?: number } })
sophia.missions.create({ command: 'sales:pricing-optimizer',  params: { product: string; competitors?: string } })
sophia.missions.create({ command: 'sales:outreach-sequence',  params: { prospect_name: string; product?: string } })

// --- GTM & Leads ---
sophia.missions.create({ command: 'gtm:campaign',   params: { product: string; target_audience?: string } })
sophia.missions.create({ command: 'lead:generate',  params: { icp_description: string; count?: number } })

// --- CRM / Analytics / Email ---
sophia.missions.create({ command: 'crm:sync',         params: { contact_id: string; data: Record<string, unknown> } })
sophia.missions.create({ command: 'analytics:export', params: { report_type: string; date_range?: string } })
sophia.missions.create({ command: 'email:send',       params: { to: string; subject: string; body: string } })
```

### Available commands reference

| Command | MCU | Description |
|---|---|---|
| `proposal:create` | 5 | Generate sales proposal |
| `video:create` | 10 | Create AI video |
| `affiliate:generate` | 3 | Generate affiliate content |
| `affiliate:scrape` | 2 | Scrape affiliate programs |
| `content:blog` | 3 | Write blog post |
| `content:social` | 2 | Social media content |
| `crm:sync` | 1 | Sync CRM data |
| `analytics:export` | 2 | Export analytics |
| `gtm:campaign` | 5 | GTM campaign plan |
| `sales:battlecard` | 3 | Competitive battlecard |
| `sales:proposal-deck` | 5 | Slide deck |
| `sales:roi-calculator` | 3 | ROI analysis |
| `sales:competitor-analysis` | 5 | Deep competitor report |
| `sales:pricing-optimizer` | 3 | Pricing strategy |
| `sales:outreach-sequence` | 5 | Email outreach sequence |
| `lead:generate` | 5 | AI prospect research by ICP |
| `email:send` | 1 | Send email via Resend |

## Pricing tiers

| Tier | MCU/mo | Price |
|---|---|---|
| Free | 200 | $0 |
| Starter | 500 | $49/mo |
| Growth | 2,000 | $149/mo |
| Premium | 10,000 | $499/mo |
| Master | 25,000 | $999/mo |

Full documentation at https://sophia.ai/docs/api

## License

MIT
