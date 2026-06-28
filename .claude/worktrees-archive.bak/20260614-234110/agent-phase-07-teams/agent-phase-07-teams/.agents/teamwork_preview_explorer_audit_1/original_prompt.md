## 2026-05-30T12:03:24Z
Analyze the full system topology, bounded contexts, service orchestration, runtime boundaries, hot paths, concurrency models, state flows, and Cloudflare/D1/R2 infrastructure dependencies.
1. Scan the codebase (especially apps/sophia-ai-factory/src/ and wrangler.toml, next.config.ts, open-next.config.ts) to understand the layout and runtime architecture.
2. Document the exact file links and code symbol references for major entry points and runtime paths.
3. Identify the main database tables, schemas, indexes, and queries, and map how data flows between next.js frontend, Cloudflare D1/R2, n8n, and external APIs (OpenRouter, HeyGen, ElevenLabs, fal.ai, publishers).
4. Write your findings in a structured report handoff.md in your working directory /Users/macbook/projects/sophia-ai-factory/.agents/teamwork_preview_explorer_audit_1/.
5. Keep the report focused on facts, concrete file paths, and exact functions.
