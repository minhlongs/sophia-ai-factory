# Sophia Proposal - README

**Version:** 0.1.0
**Status:** ✅ Production Ready

---

## Quick Start

### Prerequisites
- Node.js 18+
- pnpm 9.15.0+

### Install
```bash
cd apps/sophia-proposal
pnpm install
```

### Development
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build
```bash
pnpm build
```

### Test
```bash
pnpm test
```

---

## Project Structure

```
app/
├── components/
│   ├── sections/    # 10 section components
│   └── layout/
├── lib/             # Data utilities
├── page.tsx
├── layout.tsx
└── globals.css

docs/                # Documentation
tests/               # Test setup
plans/               # Project plans
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.1.6 |
| UI Library | React 19.2.3 |
| Language | TypeScript 5.9.3 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion 12 |
| Icons | Lucide React |
| Testing | Vitest |
| Deployment | Vercel |

---

## Components

1. **Hero** - Value proposition
2. **Workflow** - 4-step process
3. **Features** - Capabilities
4. **AffiliateDiscovery** - 18 programs
5. **Pricing** - 4 tiers
6. **TechStack** - Technologies
7. **ROICalculator** - ROI projection
8. **Affiliates** - Success stories
9. **FAQ** - Questions
10. **Footer** - Links

---

## Documentation

- [Project Overview](./docs/project-overview-pdr.md)
- [System Architecture](./docs/system-architecture.md)
- [Code Standards](./docs/code-standards.md)
- [Development Roadmap](./docs/development-roadmap.md)

---

## Deployment

```bash
git push origin master
```

Production: https://sophia-ai-factory.vercel.app

---

## License

Private - AgencyOS
