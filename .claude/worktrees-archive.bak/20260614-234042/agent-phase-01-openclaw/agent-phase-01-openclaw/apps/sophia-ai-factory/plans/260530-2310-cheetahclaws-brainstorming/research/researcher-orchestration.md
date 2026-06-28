# Orchestration Report: OpenClaw vs CheetahClaws Orchestrator Comparison

This report compares OpenClaw (Phase 12 edge orchestrator) and CheetahClaws (local CLI agent) in terms of orchestration primitives, multi-tenancy, and security trade-offs.

## 1. Primitives & Architecture Comparison

| Feature | OpenClaw | CheetahClaws |
|---|---|---|
| **Primary Focus** | Edge-native SaaS multi-tenant orchestrator | Local CLI developer agent with shell capabilities |
| **Runtime Environment** | Cloudflare Workers Edge (strict limits) | Host Machine (Node/Python, Docker) |
| **Core Primitives** | 10 Primitives (`spawnAgentFleet`, `withTenant`, `memory`, `mcp`, `queue`, `onEvent`/`emit`, `activateSkill`, `scheduleAgent`, `audit`, `rateLimitGate`/`routeLLM`) | Auto-fanout, Multi-provider mapping, Shell execution, compaction, session store |
| **Orchestration Model** | Explicit bounded fleets with retry & circuit breakers | Implicit map-reduce parallel subagents (`auto_fanout`) |
| **API Provider Strategy**| Tier-based LLM routing (`routeLLM`) | Dynamic prefix mapping (`providers.py` to 10+ endpoints) |

---

## 2. Deep-Dive on Core Primitives

### OpenClaw Edge Primitives
1. `spawnAgentFleet`: Runs tasks sequentially or concurrently (maxConcurrency limit), enforcing circuit-breaker patterns (`withBreaker`) and retry backoffs. Requires `tenantId` or throws error.
2. `withTenant`/`runAsTenant`: Scopes D1 execution context and query results dynamically to enforce row-level isolation.
3. `memory`: Scopes all key-value operations using `tenantId` prefix (falls back to D1 `memory_kv` table).
4. `mcp`: MCP client gateway using a strict whitelist (`youtube`, `tiktok`, `supabase`, `claude-mem`, `pencil`) and tenant-custom HTTPS endpoints with encrypted tokens. Explicitly blocks banned tools (`polar`).
5. `queue`: Inngest queue wrapper that stamps all messages with `tenantId` and records audit events.
6. `audit`: Records all agent events with actor and tenant metrics.

### CheetahClaws Orchestration Features
- `auto_fanout`: Evaluates tool result sizes. If a text result exceeds a context threshold (default 40% of context window), it chunks the text (with overlap) and runs parallel map-reduce subagents (max 6) to extract query-relevant context before appending it to the history.
- `multi-provider mapping`: Centralized registry in `providers.py` supporting 10+ providers (Anthropic, OpenAI, Gemini, Ollama, DeepSeek, Kimi, Zhipu, etc.) via dynamic configuration and API key environment mapping.

---

## 3. Security and Multi-Tenancy Trade-Offs

### Tenant Isolation & Data Leakage
- **OpenClaw (High Security)**: Enforces zero-trust database isolation. All operations (fleet, memory, queue, MCP gateway) inject and require `tenantId`. A tenant cannot access another tenant's custom MCP server configurations or memory.
- **CheetahClaws (Low Tenancy)**: Flat execution model. Designed for single-tenant local host workloads. Settings (`config.json`) and API keys are stored globally. It cannot isolate tenants natively in shared runtime environments.

### Sandbox & Host Privilege Control
- **OpenClaw (Hard Sandbox)**: Runs inside Cloudflare Workers Edge. No direct shell access. System calls are impossible. Tool access is mediated strictly via the whitelisted MCP gateway.
- **CheetahClaws (Loose Sandbox)**: Directly executes commands on the host machine. While hardened via `shell_policy: "script"` to avoid raw command injection, the agent still runs under host user permissions.

### Cost Control & Cost Scaling
- **OpenClaw**: Fleet-level budget checks (`maxTotalIterations`) prevent runaway loops. Rate-limiting and LLM cost-trackers monitor per-tenant resource consumption.
- **CheetahClaws**: `auto_fanout` spawns parallel sub-LLM calls automatically for large tool outputs. This reduces context usage but can cause sudden, un-monitored spikes in token consumption and api costs without per-tenant quota ceilings.

---

## 4. Final Recommendations
- **Maintain OpenClaw** as the core multi-tenant orchestrator for the Sophia AI Factory production service to guarantee tenant database boundaries, edge-performance, and compliance.
- **Utilize CheetahClaws** solely for local developer debugging, code generation, and single-user CLI-driven workflows, ensuring its config remains hardened (`shell_policy = "script"`).
