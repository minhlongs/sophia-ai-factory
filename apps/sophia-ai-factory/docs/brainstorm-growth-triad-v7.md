# Deep Brainstorm Contract: Growth Triad v7
## Dynamic Sponsorship Valuation, Saliency Re-Framer & Thumbnail Gaze Matrix

### 1. Executive Intent & Overview
Growth Triad v7 expands Sophia AI Factory's autonomous monetization and distribution capabilities for faceless video creators across three critical vectors:
1. **Dynamic Brand Sponsorship Valuation & Pitch Engine:** Monetizes audience scale before and beyond AdSense by calculating mathematically grounded sponsorship rate cards and programmatic media kits.
2. **Intelligent Multi-Aspect Saliency Re-Framer & Kinetic Captioner:** Maximizes multi-platform reach (YouTube 16:9 to TikTok/Reels/Shorts 9:16) with smoothed focal saliency tracking and kinetic typography.
3. **Visual Saliency Thumbnail Matrix & Simulated CTR Gaze Predictor:** Predicts viewer gaze fixation, text contrast ratios, and visual saliency scores to optimize video click-through rates before publishing.

---

### 2. Bounded Delivery Contract

#### Outcome
- Programmatic calculation of sponsorship rate cards based on predicted 30-day views, niche CPM tiers, engagement rate, and Tier-1 audience geographic weighting.
- Automated multi-aspect crop coordinate calculator with exponential smoothing to eliminate camera jitter during dynamic 9:16 reframing, paired with kinetic caption token sequencing.
- Multi-scale visual saliency heatmap scoring ($S \in [0, 1]$), rule-of-thirds focal alignment validation, and predicted CTR grading.
- Clean Architecture implementation across all 5 layers (`seed`, `tree`, `forest`, `land`, `presentation`) with zero `:any` types and 100% passing tests.

#### Constraints
- **File Length Limit:** Strict compliance with `< 200 lines` per file.
- **Layer Boundary Enforcement:** `seed` $\to$ `tree` $\to$ `forest` $\to$ `land` $\to$ `presentation`. No illegal upstream imports.
- **Zero-IO Pure Tree Engines:** Tree layer functions must be deterministic, pure, and zero-IO.
- **Synchronous D1 Database Access:** Database operations use synchronous `createServerClient()` without forbidden `await`.
- **Inngest Event Registry Exactness:** Inngest event registry updated cleanly to 83 keys with bidirectional type checks in `client-merge.test.ts`.

#### Non-Goals
- Real-time video pixel rendering / FFmpeg GPU hardware encoding (delegated to external workers / R2 asset pipelines).
- Actual outgoing SMTP mail server dispatch (mocked via structured payload in Server Actions; delivery handled via webhooks).
- Heavy deep-learning ONNX model inference in edge runtime (emulated via deterministic multi-scale gradient and contrast algorithms).

#### Acceptance Criteria
1. Mathematical unit tests validating sponsorship valuation, jitter-free saliency bounding box smoothing, and multi-scale saliency CTR calculation.
2. D1 Migration `0463_growth_triad_v6.sql` followed by `0464_growth_triad_v7.sql`.
3. Inngest background jobs registered and verified with compile-time event map validation.
4. Next.js Server Actions with Better Auth session validation and D1 SQLite storage.
5. React UI Cockpits adhering to the amber-400 / indigo design system with bilingual labels.
6. `npm run type-check` with 0 errors and `bash scripts/check-layer-boundaries.sh` clean.

---

### 3. Mathematical Foundations

#### Pillar 1: Dynamic Sponsorship Valuation
The estimated rate card value $V_{\text{sponsor}}$ in USD:
$$V_{\text{sponsor}} = \text{BaseCPM} \times \left( \frac{E[\text{Views}_{30d}]}{1000} \right) \times \Phi_{\text{niche}} \times (1 + \lambda_{\text{engagement}}) \times \gamma_{\text{geo}}$$
- $\text{BaseCPM} \in [15.0, 45.0]$
- $\Phi_{\text{niche}} \in \{ \text{FINANCE}: 2.2, \text{SAAS}: 1.8, \text{CRYPTO}: 2.0, \text{TECH}: 1.5, \text{LIFESTYLE}: 0.9 \}$
- $\lambda_{\text{engagement}} = \min(0.50, \text{EngagementRate} \times 10)$
- $\gamma_{\text{geo}} = 0.50 + 0.50 \times \text{Tier1AudienceShare}$

#### Pillar 2: Saliency Re-Framing & Smoothing
Center of bounding crop window $c_x(t) \in [0, W]$:
$$c_x(t) = \alpha \cdot c_x(t-1) + (1 - \alpha) \cdot x_{\text{focal}}(t)$$
where smoothing factor $\alpha = 0.85$ eliminates camera panning jitter while maintaining human face and object centering.

#### Pillar 3: Visual Saliency & Predicted CTR
Multi-feature saliency score:
$$S = w_I \cdot I_{\text{contrast}} + w_C \cdot C_{\text{opponency}} + w_O \cdot O_{\text{edge}}$$
Predicted CTR:
$$\text{CTR}_{\text{pred}} = \frac{1}{1 + e^{- (z - z_0)}} \times \text{CTR}_{\text{max}}$$
where $z$ aggregates face prominence, color saturation, and focal alignment with rule-of-thirds power intersections.
