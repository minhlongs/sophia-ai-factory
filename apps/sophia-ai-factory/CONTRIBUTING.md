# Contributing to Sophia AI Factory

This document is for developers who want to modify the source code. If you are a user, please see `HANDOFF.md`.

## Tech Stack
- **Framework**: Next.js 16.1.6 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State**: React Server Components + Client Hooks

## Project Structure
- `src/app`: App Router pages
- `src/lib`: Utility functions and validators
- `src/components`: Reusable UI components
- `scripts`: CLI setup tools

## Setup for Development
1. Run `npm install`
2. Run `npm run dev`
3. Edit `src/app/page.tsx` for the dashboard.

## Code Standards
- Use `kebab-case` for filenames.
- Keep components under 200 lines.
- Use `zod` for validation.

## Environment Variables
See `.env.example` (if available) or the Setup Wizard's output in `.env.local`.
