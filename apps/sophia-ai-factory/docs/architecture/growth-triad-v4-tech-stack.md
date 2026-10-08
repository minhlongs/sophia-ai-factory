# Growth Triad v4: Tech Stack & Architecture Specification
## Autonomous Retention, Affiliate Scaling & Cross-Platform Repurposing Suite

### Executive Summary
Growth Triad v4 introduces three synergistic engines designed for non-technical CEOs to automate revenue retention, high-yield affiliate promotion, and cross-platform video mutation under Clean Architecture.

### Core Architecture Pillars

```
+--------------------------------------------------------------------------+
|                        Growth Triad v4 Suite                             |
+------------------------------------+-------------------------------------+
| Pillar 1: AI Retargeting & Churn   | RFM Matrix, Churn Hazard Score,     |
| Win-Back Engine                    | Margin-Guarded Discount Staircase   |
+------------------------------------+-------------------------------------+
| Pillar 2: High-Velocity Affiliate  | 7-Day Rolling EPC/RPM Scoring,      |
| Co-Pilot & Dynamic Matcher         | Sub-ID Attribution, Commission FSM |
+------------------------------------+-------------------------------------+
| Pillar 3: Multi-Platform Viral     | Saliency Hook Index (0-3s),         |
| Repurposer & Adaptive Cropper      | 9:16 / 1:1 Aspect Transform FSM     |
+------------------------------------+-------------------------------------+
```

### Technology Matrix
- **Runtime & Compute:** Cloudflare Workers (Edge runtime) + Inngest Serverless Durable Functions.
- **Persistence:** Cloudflare D1 (SQLite) with zero-cost WAL indices (`0461_growth_triad_v4.sql`).
- **Mathematical Engines (`src/tree`):**
  - *RFM & Churn:* Pure deterministic Recency, Frequency, Monetary scoring with Weibull-style hazard decay: $H(t) = \lambda k (\lambda t)^{k-1}$.
  - *EPC Velocity:* Dynamic rolling EPC ($\text{Revenue} / \text{Clicks}$) with tiered commission escalators.
  - *Saliency Cropper:* Subject center-of-mass focal point calculation with safe-zone clamping for 9:16 and 1:1 viewports.
- **State & Server Actions (`src/land`):** Authenticated Next.js Server Actions with Better Auth session validation and atomic D1 batch insertions.
- **Presentation (`src/components/growth-triad-v4`):** Responsive cockpits adhering to Sophia Amber (`35 80% 44%`) and Indigo tokens.
