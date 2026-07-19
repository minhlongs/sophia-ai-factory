# Sophia AI Factory: Tech Stack & Workflow Strategy Report

## 1. Tech Stack Evaluation & Synergy

Sophia AI Factory utilizes a hybrid stack consisting of **Next.js 16**, **Cloudflare Workers (via OpenNext)**, **Inngest**, and **n8n**. This combination balances rapid UI iteration with high-performance edge compute and asynchronous workload execution.

### Next.js 16 + Cloudflare Workers (Edge Compute Layer)
* **Synergy:** Delivers a global, zero-cold-start web portal and proxy API layer. Colocating Edge runtime with Cloudflare D1 (SQLite) and R2 (Object Storage) minimizes latency.
* **Friction Points:** Next.js App Router compilation to OpenNext requires custom build-time overrides (e.g., `inject-scheduled-handler.mjs` for cron jobs). Edge runtime limits access to standard Node.js libraries (`fs`) and imposes CPU time limits (50ms on free tier).

### Inngest Event Pipeline vs. n8n Visual Automation (Execution Layer)
* **Inngest:** Handles multi-step, complex AI tasks (Wan 2.1 + Fish Speech) with high reliability. Type-safe schemas (`src/forest/inngest/client.ts`) and automatic retry policies prevent failure cascades.
* **n8n:** Visual workflows orchestrate script generation (OpenRouter) and video rendering (ElevenLabs + D-ID). It provides extreme operational flexibility but introduces performance bottlenecks due to its integration with Airtable (rate-limited to 5 req/sec).

---

## 2. n8n Workflow Updates vs. Code Mutations

The core architectural tension lies between the speed of visual workflow adjustments in n8n and the safety of codebase mutations.

| Dimension | n8n Visual Workflows | Code Mutations (TypeScript / Workers) |
| :--- | :--- | :--- |
| **Velocity** | **High** (Near real-time). Updates visual nodes without redeployment or build steps. | **Moderate**. Requires compilation, linting (Biome), testing (Vitest), and Cloudflare deployment. |
| **Reliability** | **Low**. Lacks static typing, automated unit tests, and runtime schema validation. | **High**. Enforced via strict type checking, linting, and automated tests. |
| **Governance** | **Weak**. Stored as JSON files or DB blobs. Hard to review (diffs), audit, or rollback. | **Strong**. Maintained in Git. PR reviews enforce code quality, security, and architectural rules. |
| **Limits** | **External bound**. Webhook dispatch is synchronous; Airtable rates limit throughput. | **Edge bound**. CPU execution limits and memory limits of Cloudflare Workers isolates. |

### Architectural Evolution (Agentic Patterns)
As defined in `docs/ai-architecture-2026-update.md`, advanced agentic behaviors (such as the Reflection Pattern for quality gates, or Google ADK Parallel/Loop agents) are highly code-centric. Visual builders like n8n struggle to model complex self-critique loops and parallel state merges cleanly. While n8n excels for simple, operational pipelines, robust agentic workflows must be built as code mutations.

---

## 3. Strategic Recommendations

To resolve architectural friction and align with the 4-Layer Mekong Architecture (`land → forest → tree → seed`), we recommend:

1. **Decouple n8n Webhook Triggers (Queue-First pattern):**
   * *Strategy:* Replace synchronous HTTP postbacks to n8n with an asynchronous outbox queue in D1. Next.js writes to a `job_outbox` table, and an Inngest worker dispatches tasks with built-in retries, insulating the user UI from n8n downtime.
2. **Phase out Airtable as the Automation Data Store:**
   * *Strategy:* Migrate the n8n data layer entirely to D1/R2. Expose internal Next.js REST endpoints for n8n to query and write data, removing the 5 req/sec Airtable bottleneck.
3. **Graduate Prototypes from n8n to Inngest:**
   * *Strategy:* Use n8n exclusively for rapid prototyping and prompt experimentation. Once a workflow (like script generation) stabilizes, port it into a native TypeScript Inngest function for type safety, unified logging, and lower API cost.
4. **Automate n8n Version Control:**
   * *Strategy:* Set up an automated pipeline to sync n8n JSON schemas into the Git repository (`/apps/sophia-ai-factory/n8n/`) via n8n's export CLI. This subjects visual changes to the standard PR code review process.

---

## 4. Unresolved Questions

1. *Inngest Edge Compatibility:* Does running Inngest workers on Cloudflare Workers edge runtime introduce package-size or CPU execution time bottlenecks under heavy video encoding jobs?
2. *State Synchronization during Migration:* How do we handle in-flight campaigns and scripts if we dynamically migrate from Airtable to D1 without user disruption?
3. *n8n Local/BYOK Multi-tenant Isolation:* How can we safely sandbox user-provided API keys (BYOK) if those keys are resolved dynamically within n8n workflows, without exposing them in n8n logs?
