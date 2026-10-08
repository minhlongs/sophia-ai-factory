# Design Guidelines: Creative Auto-Mutator Cockpit

**Design System:** Sophia Obsidian Cyber-Glass
**Color Tokens (from `globals.css`):**
- Primary: Amber (`hsl(35, 80%, 44%)` / `#d97706` / `#f59e0b`)
- Accent / Secondary: Indigo (`#6366f1` / `#4f46e5`)
- Background: Obsidian Dark (`#090d16` / `#0f172a`)
- Card Surface: Cyber Glass (`rgba(15, 23, 42, 0.75)` with `backdrop-filter: blur(12px)`)
- Border: Cyber Border (`rgba(255, 255, 255, 0.08)`)
- Typography: Inter body, clean geometric display, strictly no display Inter.

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
