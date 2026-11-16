# Design Guidelines: Creative Auto-Mutator Cockpit

**Design System:** Zen Design OS v1.0 (`src/app/globals.css` & `DESIGN.md`)
**Color Tokens (from `src/app/globals.css`):**
- Primary: Electric Indigo (`#6366F1` dark / `#4338CA` light; `--primary-text: #818CF8` dark)
- Accent / Warning: Cinema Amber (`#F59E0B` dark / `#B45309` light)
- Background: `--background` (`#090A10` dark default / `#F8F9FC` light)
- Card Surface: `--card` (`#11131F` dark / `#FFFFFF` light)
- Border: `--border` (`#1E2235` dark / `#E2E8F0` light)
- Typography: `Inter` (`--font-sans`) for product UI & headings, `JetBrains Mono` (`--font-mono`) for telemetry/metrics.

---

## Cockpit Layout Structure

1. **Header & Mode Bar:**
   - Title: "Darwinian Creative Auto-Mutator"
   - Status Indicator: Active Evolutionary Breeding Pool
   - Global Dial Controls: Mutation Intensity (`Conservative`, `Moderate`, `Radical`), Exploration Temperature (0.1 - 1.0), Auto-Spawn Toggle.

2. **Gene Pool Summary Cards (4 KPIs):**
   - Active Lineages ($G_0 \to G_n$)
   - Average Mutation Gain (+X% Hook Score)
   - Survival / Win Rate (%)
   - Saved Render MCUs via Early Pruning

3. **Evolutionary Lineage Visualizer:**
   - SVG-based family tree connecting parent $G_0$ to mutated children $G_1, G_2$.
   - Interactive nodes with color-coded fitness badges (Green $\ge 80$, Yellow $60-79$, Red $< 60$).

4. **Mutation Diff & Gene Inspector:**
   - Side-by-side comparison of Parent vs Mutated Offspring:
     - Opening 3s Hook text & archetype
     - Visual B-Roll prompt & style tag
     - Audio pacing & tempo multiplier (e.g. `1.10x High-Energy`)
     - CTA text & coupon code

5. **Offspring Dispatch Queue:**
   - List of newly bred variants with "Deploy to Render", "Schedule AB Test", or "Prune" actions.
