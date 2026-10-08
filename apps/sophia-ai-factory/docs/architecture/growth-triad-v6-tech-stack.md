# Growth Triad v6 Tech Stack & System Architecture
## Search-Surge SEO Jacker, Smart-Link Yield Engine & Retention Survival Trimmer

### Architectural Principles
- **Clean Architecture 5-Layer Segregation**:
  - `seed`: Types, Zod validation, D1 table definitions, Inngest event keys.
  - `tree`: Zero-IO algorithmic engines (Kaplan-Meier survival estimator, $Z$-score anomaly detector, EPC expected yield model).
  - `forest`: Inngest background orchestration jobs managing cron triggers and analytics updates.
  - `land`: Server Actions secured via Better Auth `getCurrentUser()` and Cloudflare D1.
  - `presentation`: Modular React components styled with design tokens in `src/app/globals.css`.

### Algorithmic Foundations
1. **Search Surge Anomaly Detection**:
   $$\mu_V = \frac{1}{N}\sum_{i=1}^N V_i, \quad \sigma_V = \sqrt{\frac{1}{N}\sum_{i=1}^N (V_i - \mu_V)^2}, \quad Z = \frac{V_t - \mu_V}{\sigma_V}$$
   Surge alert triggered when $Z \ge 2.50$ and current search velocity $> 500$ queries/hr.

2. **Affiliate Smart-Link Expected Yield**:
   $$E[\text{Yield}] = \text{EPC} \times \sqrt{\text{Gravity}} \times (1 - \text{RefundRate}) \times \text{NicheMatchScore}$$
   Ranks available affiliate offers per video topic and handles automated geo-targeted fallback routing.

3. **Kaplan-Meier Survival Estimator**:
   $$\hat{S}(t) = \prod_{t_i \le t} \left(1 - \frac{d_i}{n_i}\right)$$
   Detects drop-off cliff points where $\Delta S / \Delta t < -0.08$ within a 3-second sliding window to trigger pacing recommendations.
