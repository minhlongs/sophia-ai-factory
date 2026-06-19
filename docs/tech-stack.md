# Tech Stack: Sophia AI Factory (Coverage Enforcement)

The project uses a cutting-edge AI SaaS stack optimized for edge performance and high reliability.

## Core Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript.
- **Styling**: Tailwind CSS 4.
- **Internationalization**: `next-intl` (EN/VN).
- **Backend/Edge**: Cloudflare Workers (Wrangler).
- **Background Jobs**: Inngest.
- **Authentication**: Better Auth.
- **Database**: 
  - Cloudflare D1 (SQLite) for edge/auth.
  - Supabase (Postgres) for rich data/admin.
- **Infrastructure**: Cloudflare Pages/Workers, Fly.io (for Python services).

## AI & External Integration
- **Video/Audio**: HeyGen, ElevenLabs, MuAPI.
- **LLMs**: OpenRouter.
- **Payments**: NOWPayments (Crypto), PayOS (VN).

## Tooling & Quality Assurance
- **Unit Testing**: Vitest (Goal: 60% coverage for core logic).
- **E2E Testing**: Playwright.
- **Load Testing**: k6.
- **CI/CD**: Cloudflare-direct deployment (moving towards structured pipeline).

## Architecture Principles
- **BYOK (Bring Your Own Key)**: Minimize operational overhead and vendor lock-in.
- **SOP-Driven**: Automated playbooks via `lib/sop` engine.
- **YAGNI / KISS / DRY**: Core engineering constraints.
