# Phase 3: Hero Section WOW

## Context
- **Plan:** [Overview](./plan.md)
- **Research:** [Framer Motion Effects](../research/researcher-02-framer-motion-effects.md)
- **Target App:** `apps/sophia-proposal`

## Overview
The Hero section is the first impression. It needs to stop the scroll. We will implement a high-energy, animated hero with typing text, floating 3D elements, and a dynamic background.

## Key Insights
- **Typing Animation:** Builds anticipation for the value proposition.
- **Floating 3D Elements:** Adds depth to the flat screen.
- **Particle Background:** "Starfield" or "Orbs" create a living environment.

## Requirements
1.  **Background:** Animated gradient mesh or particle system.
2.  **Headline:** Staggered entry + Typing effect for keywords (e.g., "OpenClaw", "n8n", "AI Video").
3.  **Visuals:** Floating 3D cards/icons representing the tech stack.

## Architecture
- **Component:** Redesign `app/components/sections/Hero.tsx`.
- **Library:** Use `framer-motion` for all entrance and loop animations.

## Related Code Files
- Modify: `app/components/sections/Hero.tsx`

## Implementation Steps

1.  **Dynamic Background**
    - Create a background layer with slowly moving gradient orbs (`animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}`).

2.  **Typography Animation**
    - Use Framer Motion `staggerChildren` for the main headline.
    - Implement a `Typewriter` component for the dynamic keyword.

3.  **Floating Elements**
    - Create "Tech Cards" (e.g., n8n logo, OpenClaw logo) that float around the main text.
    - Use `animate={{ y: [0, -20, 0] }}` with different durations for organic feel.

4.  **CTA Button Glow**
    - Add a "breathing" shadow effect to the primary CTA.

## Code Example (Hero Animation)
```tsx
import { motion } from "framer-motion";

const float = {
  animate: {
    y: [0, -20, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }
  }
};

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-0 left-0 w-96 h-96 bg-neon-purple/30 rounded-full blur-[100px]"
      />

      <div className="z-10 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl font-space font-bold"
        >
          Automate Video with <span className="text-neon-cyan">AI Power</span>
        </motion.h1>
      </div>
    </section>
  );
}
```

## Todo List
- [x] Implement animated gradient background.
- [x] Build `Hero` component with Framer Motion text reveals.
- [x] Add floating 3D icons for n8n/OpenClaw.
- [x] Ensure mobile responsiveness (stack elements, reduce animation complexity).

## Success Criteria
- [x] Headline animates in smoothly.
- [x] Background feels "alive" but not distracting.
- [x] Zero layout shift during animation load.

## Risk Assessment
- **Risk:** Text readability over complex background.
- **Mitigation:** Use sufficient overlay/dimming on the background or text shadows.

## Next Steps
- Proceed to [Phase 4: Motion System](./phase-04-framer-motion-integration.md).
