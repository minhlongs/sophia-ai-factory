# Sophia AI Factory 🏭

**Automated AI Video Production Empire**

![Sophia AI Factory](https://placehold.co/1200x400?text=Sophia+AI+Factory+Preview)

Sophia is a turnkey solution that automates the entire lifecycle of "Faceless" YouTube channels. It discovers high-ROI affiliate products, writes engaging scripts using LLMs, generates voiceovers and avatars, and manages your content calendar.

## 🌟 Features
- **Auto-Discovery**: Scans Amazon/Clickbank for trending high-commission products.
- **AI Scriptwriter**: Uses Claude/GPT-4 via OpenRouter to write viral scripts.
- **Video Generation**: Integrates ElevenLabs (Voice) and HeyGen (AI Video).
- **Turnkey Setup**: Built-in wizard configuration - no coding required.

## 🚀 Getting Started

**[👉 CLICK HERE TO READ THE USER MANUAL (HANDOFF.md)](./HANDOFF.md)**

1. Install: `npm install`
2. Run: `npm run dev`
3. Setup: Follow the Wizard at `http://localhost:3000`

## 🛠 Developer Info
Want to customize the code? Start with [CONTRIBUTING.md](./CONTRIBUTING.md), then dive into [docs/dev-sops.md](./docs/dev-sops.md) — 10 canonical Developer SOPs (setup, testing, routes, deploy, debug, CI gates, security).

## 🏗 Architecture / Kiến trúc
Codebase follows the Mekong 4-layer model (`seed → tree → forest → land`) with one-way import direction enforced by ESLint — see [docs/system-architecture.md](./docs/system-architecture.md).

---
*Built with Next.js 16, TypeScript, and Tailwind CSS 4.*
