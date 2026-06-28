# Compatibility Report: CheetahClaws on Cloudflare Workers Edge Runtime

## 1. Executive Summary
CheetahClaws is **incompatible** with Cloudflare Workers Edge Runtime for direct native execution due to runtime VM, memory, CPU, and filesystem constraints. While Sophia AI Factory's TypeScript-native **OpenClaw** design is optimized for V8 isolates, Cloudflare D1 database, and R2 storage, CheetahClaws is a Python-native CLI tool built for local developer environments. Running CheetahClaws directly on Workers would require a heavy WASM wrapper (e.g., Pyodide), which violates Workers' resource limits.

## 2. Comparison: OpenClaw vs. CheetahClaws

| Architectural Dimension | OpenClaw (Sophia's Edge-Native Design) | CheetahClaws Design |
| :--- | :--- | :--- |
| **Language & VM** | TypeScript/JavaScript on V8 Isolates | Python-native on standard Python VM |
| **Persistence** | Cloudflare D1 (SQL), R2 (Media), KV (State) | File-based local configs (`.json`, `.env.local`) |
| **Orchestration** | Inline/non-blocking via Inngest & cron triggers | Generator-based loop, synchronous CLI/REPL |
| **Tool Execution** | API-driven integrations, Cloudflare edge functions | Direct OS tool execution (`grep`, file writes, bash) |
| **LLM Hosting** | Remote APIs (OpenRouter, ElevenLabs, HeyGen) | Remote APIs & Local-first models (Ollama, vLLM) |

## 3. Feasibility Analysis under Workers Limits

*   **Memory (Limit: 128MB):** **Infeasible.** Running Python on Workers requires Pyodide (WASM). Pyodide's initialization bundle size and runtime memory exceed 150MB, causing immediate Out-Of-Memory (OOM) failures. In contrast, OpenClaw runs natively as lightweight JS/TS chunks using <30MB memory.
*   **CPU Execution Time (Limit: 50ms):** **Infeasible.** Python interpretation via WASM and sequential reasoning loops exceed 50ms of active CPU time during VM initialization alone. While OpenClaw's network requests (like OpenRouter API calls) suspend the Worker thread and do not count toward CPU time, CheetahClaws' synchronous tool execution would hit the threshold quickly.
*   **No Local Filesystem (`no local fs`):** **Infeasible.** CheetahClaws relies on local filesystem tools (`read_file`, `write_file`, `grep`) to read configurations, save logs, and inspect directories. Workers run in a stateless sandbox with no persistent filesystem. OpenClaw routes state persistence to D1/R2.
*   **Local Ollama Integration:** **Infeasible.** Cloudflare Workers run on global public edges and cannot resolve local loopbacks (`localhost:11434`) or local network targets directly without a tunnel (e.g., Cloudflare Tunnel).

## 4. Recommendations & Workarounds
To leverage CheetahClaws in a Sophia AI Factory deployment:
1.  **Orchestrator-Agent Split (Recommended):** Deploy CheetahClaws on a VPS/local server and expose its capabilities via a **Model Context Protocol (MCP) server** or a REST API. The Edge Worker (running OpenClaw/Next.js) then acts as a client calling the CheetahClaws server.
2.  **State Externalization:** If migrating CheetahClaws to JS/TS, replace file-based config checks and local logs with Cloudflare D1 and R2 bindings.
