# Brainstorm Contract: Growth Triad v9 Suite

**Outcome:**
Deliver the Growth Triad v9 Suite for Sophia AI Factory, focusing on advanced platform defense and hyper-localization for faceless affiliate empires. 
1. **Pillar 1: Affiliate Dead-Click Router & Yield Topology (The Yield Router):** A graph-based engine that monitors affiliate link health (HTTP 404s, out-of-stock, changed EPCs) and dynamically routes traffic using Dijkstra/A* to the next best equivalent offer in real-time.
2. **Pillar 2: Algorithmic Shadowban Evasion & Fingerprint Anomaly (The Ghost Matrix):** A statistical anomaly detection engine (Z-score / Isolation Forest approximations) evaluating posting frequency, metadata entropy, and hashtag repetition to predict and prevent platform shadowbans before they occur.
3. **Pillar 3: Hyper-Local Meme & Cultural Semantic Sync (The Culture Injector):** A semantic scoring engine indexing dialect terminology (e.g., Northern vs. Southern Vietnam slang), regional trends, and acoustic/visual memes to score the "Cultural Alignment Index" (CAI) of generated scripts.

**Constraints:**
- **Product Doctrine:** Platform-only operations. Must strictly adhere to BYOK (no operator managed proxies or affiliate keys required to boot).
- **Architecture:** 4-Layer Clean Architecture (`seed` -> `tree` -> `forest` -> `land`).
- **Purity:** `tree` layer algorithms MUST be Zero-IO, rigorously mathematical, and 100% covered by Vitest.
- **Code Quality:** Zero `:any` types. Zod payload exactness.
- **File Limits:** Every code file strictly `< 200 lines`.

**Non-Goals:**
- Operating proxy IP infrastructure for clients.
- Direct scraping of TikTok/YouTube shadowban internal APIs (we rely on predictive statistical heuristics from client telemetry).
- Managing third-party affiliate merchant accounts.

**Acceptance Criteria:**
- Mathematical specification defined for Dead-Click Routing, Shadowban Z-Scores, and Cultural Alignment.
- `tree` layer pure implementations pass 100% mathematical regression tests.
- `seed` layer exact-type extensions (Inngest 86 -> 89 events) compile perfectly.
- `forest` background Inngest jobs dispatch D1 writes + Quota invalidations.
- `land` Next.js server actions handle Auth + Zod payloads.
- `presentation` UI Cockpits render seamlessly with exact Tailwind palettes (e.g., Violet, Amber, Cyan).
