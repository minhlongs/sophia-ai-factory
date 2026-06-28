# Qwen3.6-35B-A3B + mekongd Integration Recipe for Sophia RaaS BYOK

**Date:** 2026-04-17  
**Status:** Research Complete  
**Target:** Enable Sophia users with M1 Max to run local AI inference via mekongd + Qwen3.6

---

## 1. Qwen 3.6-35B-A3B Snapshot

| Property | Value | Notes |
|----------|-------|-------|
| **Total Parameters** | 35B | Sparse MoE: 256 experts, 8 routed + 1 shared active |
| **Active Parameters** | 3B only | ~91.4% sparse — efficient inference |
| **Context Window** | 262K native, 1M extended | YaRN scaling supported |
| **License** | Apache 2.0 | Open source, commercial-safe |
| **Tools/Functions** | ✅ Full support | MCP integration, auto tool choice |
| **M1 Max Requirements** | ~35GB (8-bit q.), ~17.5GB (4-bit q.) | BF16 native = 70GB (exceeds 64GB) |

**Quantization Recommendation:**  
For M1 Max 64GB: Use **Q4_K_M 4-bit** (~17.5GB footprint + 4GB overhead = ~21.5GB usable). MLX or llama.cpp compatible. BF16 unquantized = **IMPOSSIBLE** without external VRAM.

**Throughput (M1 Max):**  
Estimated 25–35 tokens/sec at 4-bit on M1 Max (per mekongd README cite). MLX backend required.

---

## 2. mekongd Interface (Anthropic-Compat)

**Listen Address:** `127.0.0.1:8765` (configurable via `MEKONGD_API_HOST` + `MEKONGD_API_PORT`)

**Primary Endpoint:**
```
POST /v1/messages
```

**Request Shape (Anthropic-compat):**
```typescript
{
  "model": "Qwen/Qwen3.6-35B-A3B",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "max_tokens": 1024,
  "system": "Optional system prompt",
  "stream": false,           // true for SSE streaming
  "temperature": 0.7,
  "top_p": 0.9,
  "stop_sequences": ["\n\n"]
}
```

**Response Shape (non-stream):**
```json
{
  "id": "msg_abc123",
  "type": "message",
  "role": "assistant",
  "content": [{ "type": "text", "text": "..." }],
  "model": "Qwen/Qwen3.6-35B-A3B",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 512,
    "output_tokens": 256
  }
}
```

**Health Check:**
```bash
curl http://127.0.0.1:8765/healthz
# → {"status":"ok","runtime":"mlx","version":"0.1.0"}
```

**Router Decision Logic:**  
mekongd internally routes requests via regex patterns:
- **Local:** "read", "search", "grep", "reformat", "rename", "summarize" → stays on M1 Max
- **Cloud fallback (Anthropic):** "plan", "architect", "design", "review", "verify" → routes to API if ANTHROPIC_API_KEY set
- Default: local. Configurable via `~/.mekongd/config.toml` policy section.

**Auth:** None required (localhost assumption). For remote exposure via Tunnel, Cloudflare handles auth.

---

## 3. Cloudflare Tunnel Exposure Recipe

**User's M1 Max already has CF Tunnel running** (memory: `m1max-cf` SSH alias works).

**Add mekongd route to existing tunnel config:**

```bash
# Option A: CLI (one-time)
cloudflared tunnel route dns m1max-tunnel mekongd.yourdomain.com
# Then point to mekongd:
cloudflared tunnel route http 127.0.0.1:8765 mekongd.yourdomain.com

# Option B: Config YAML (persistent — recommended)
```

**Update `~/.cloudflared/config.yml` on M1 Max:**
```yaml
tunnel: m1max-tunnel  # existing tunnel name
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  # New: mekongd API endpoint
  - hostname: mekongd.yourdomain.com
    service: http://127.0.0.1:8765
    # Optional TLS config:
    # tls-config:
    #   origins:
    #     - https://mekongd.yourdomain.com
  
  # Existing routes below...
  - hostname: m1max.cashclaw.cc
    service: http://127.0.0.1:3000
  
  - service: http_status:404
```

**Reload tunnel:**
```bash
sudo launchctl unload /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
sudo launchctl load /Library/LaunchDaemons/com.cloudflare.cloudflared.plist
# Or: restart cloudflared service
```

**Test exposed endpoint:**
```bash
curl -X POST https://mekongd.yourdomain.com/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3.6-35B-A3B",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 10
  }'
```

---

## 4. Sophia BYOK Adapter Shape

**New file:** `apps/sophia-ai-factory/src/lib/byok/local-mekongd-adapter.ts`

```typescript
import { withTimeout } from './with-timeout';

/** Local mekongd BYOK provider */
export interface MekongdConfig {
  endpoint: string;        // e.g., "https://mekongd.yourdomain.com"
  apiKey?: string;         // Optional bearer token (Tunnel can enforce this)
  model: string;           // e.g., "Qwen/Qwen3.6-35B-A3B"
}

export async function callMekongd(
  prompt: string,
  config: MekongdConfig,
): Promise<string> {
  const response = await withTimeout(
    `${config.endpoint}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        stream: false,
      }),
      provider: 'local-mekongd',
      timeoutMs: 120_000, // 2min for local — no edge 30s limit
    },
  );

  if (!response.ok) {
    throw new Error(`mekongd error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text: string }>;
  };
  return data.content?.[0]?.text ?? '';
}
```

**Setup Wizard Form Fields (add to `ApiKeysStep`):**
```typescript
interface MekongdFormState {
  useLocalMekongd: boolean;
  mekongdEndpoint: string;      // "https://mekongd.yourdomain.com"
  mekongdApiKey?: string;       // Optional for Tunnel-based auth
  mekongdModel: string;         // Default: "Qwen/Qwen3.6-35B-A3B"
}

// New form section in setup wizard step 2:
<div className="space-y-4">
  <label>
    <input type="checkbox" onChange={() => setUseMekongd(!useMekongd)} />
    Use Local mekongd (M1 Max)
  </label>
  
  {useMekongd && (
    <>
      <input
        placeholder="https://mekongd.yourdomain.com"
        value={mekongdEndpoint}
        onChange={(e) => setMekongdEndpoint(e.target.value)}
      />
      <input
        type="password"
        placeholder="API Key (optional)"
        value={mekongdApiKey}
        onChange={(e) => setMekongdApiKey(e.target.value)}
      />
    </>
  )}
</div>
```

**Provider Adapter Integration (in `lib/byok/index.ts` or provider router):**
```typescript
export type BYOKProvider = 'openrouter' | 'elevenlabs' | 'd-id' | 'local-mekongd';

export async function callAIProvider(
  provider: BYOKProvider,
  prompt: string,
  userConfig: Record<string, string>,
): Promise<string> {
  if (provider === 'local-mekongd') {
    return callMekongd(prompt, {
      endpoint: userConfig.mekongdEndpoint,
      apiKey: userConfig.mekongdApiKey,
      model: userConfig.mekongdModel || 'Qwen/Qwen3.6-35B-A3B',
    });
  }
  // ... existing providers (openrouter, etc.)
}
```

---

## 5. Deployment Checklist

- [ ] **M1 Max:** Install mekongd: `poetry install --with mlx`
- [ ] **M1 Max:** Download Qwen3.6-35B-A3B-4bit weights: `mekongd download-model`
- [ ] **M1 Max:** Start daemon: `poetry run mekongd serve` (or systemd unit)
- [ ] **M1 Max:** Verify: `curl http://127.0.0.1:8765/healthz` → 200 OK
- [ ] **M1 Max:** Update `~/.cloudflared/config.yml` with mekongd route
- [ ] **M1 Max:** Restart Cloudflare Tunnel: `launchctl restart com.cloudflare.cloudflared`
- [ ] **Sophia:** Add local-mekongd-adapter.ts to byok/
- [ ] **Sophia:** Update setup wizard: add "Local mekongd" provider option
- [ ] **Sophia:** Test BYOK flow: user enters mekongd endpoint URL
- [ ] **Sophia:** Verify signal tracking: `byok_call` events emitted for local-mekongd

---

## 6. Open Qs / Unresolved

1. **mekongd v0.1.0 Status:** Is model download built in (`mekongd download-model`) or manual via huggingface-hub?
2. **Systemd/LaunchAgent:** Does mekongd ship with auto-start plist/systemd file or must we create it?
3. **Auth for Tunnel:** Does user need to add API key to Tunnel ingress, or is endpoint-level bearer token sufficient?
4. **Concurrent Requests:** Can M1 Max handle 2–3 simultaneous mekongd requests (Sophia + another app), or risk OOM?
5. **Fallback Logic:** If mekongd is down, should Sophia fallback to OpenRouter? Router in mekongd can forward to cloud, but Sophia's setup needs explicit fallback config.
6. **Context Limit:** Do we enforce max_tokens on Sophia's prompts to stay under 262K? Current setup assumes 4K output limit—probably safe.

---

**Report Complete.** Ready for planner to scope implementation (adapter file + setup wizard form + integration tests).

Sources:
- [Qwen3.6-35B-A3B HuggingFace](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- [mekongd README](file:///Users/macbookprom1/mekong-cli/packages/mekongd/README.md)
- [mekongd proxy.py](file:///Users/macbookprom1/mekong-cli/packages/mekongd/src/mekongd/proxy.py)
- [Sophia BYOK with-timeout.ts](file:///Users/macbookprom1/sophia-ai-factory/apps/sophia-ai-factory/src/lib/byok/with-timeout.ts)
