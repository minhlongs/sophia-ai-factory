# CLAUDE.md

<!-- CLEO:START -->

@.cleo/templates/AGENT-INJECTION.md

<!-- CLEO:END -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 16.1.6 application using the App Router architecture with React 19, TypeScript, and Tailwind CSS 4. The project uses the React Compiler (experimental) for optimized rendering.

## Development Commands

### Development Server

```bash
npm run dev
```

Starts the Next.js development server at http://localhost:3000. The app uses hot module replacement for fast iteration.

### Build & Production

```bash
npm run build  # Creates optimized production build
npm start      # Starts production server (requires build first)
```

### Linting

```bash
npm run lint   # Run ESLint with Next.js configuration
```

## Project Structure

### App Router Architecture

This project uses Next.js App Router (not Pages Router). All routes are defined in `src/app/`:

- `src/app/layout.tsx` - Root layout with fonts (Geist Sans & Geist Mono) and global styles
- `src/app/page.tsx` - Homepage component
- `src/app/globals.css` - Global styles with Tailwind directives

### Path Aliases

The project uses `@/*` path alias mapping to `./src/*` (configured in tsconfig.json).

Example:

```typescript
import { Component } from "@/components/Component";
```

### Styling

- Tailwind CSS 4 with PostCSS configuration
- Dark mode support via CSS classes (see `page.tsx` for patterns)
- Custom CSS variables for theming (check `globals.css`)

## Key Technologies

### React Compiler

The project has `reactCompiler: true` enabled in `next.config.ts`. This is an experimental feature that optimizes component rendering. Be aware:

- Avoid manual memoization (`useMemo`, `useCallback`) where possible - the compiler handles it
- Follow React's rules strictly (compiler enforces them)

### TypeScript Configuration

- Strict mode enabled
- ES2017 target for broad browser compatibility
- Module resolution: "bundler" (Next.js optimized)

### Fonts

Uses Next.js font optimization with Geist font family:

- Geist Sans (variable font)
- Geist Mono (variable font)

Fonts are defined in `layout.tsx` and applied via CSS variables.

## Development Patterns

### Creating New Pages

Add new route folders under `src/app/`:

```
src/app/about/page.tsx         # Creates /about route
src/app/blog/[slug]/page.tsx   # Creates dynamic /blog/:slug route
```

### Image Optimization

Use Next.js `Image` component from `next/image` for automatic optimization:

```typescript
import Image from 'next/image'
// Images in /public are accessible via root path
<Image src="/logo.png" alt="Logo" width={100} height={100} />
```

### Metadata

Define page metadata using the `metadata` export or `generateMetadata` function in page/layout files:

```typescript
export const metadata: Metadata = {
  title: "Page Title",
  description: "Description",
};
```

## Build Artifacts

The following directories are git-ignored and generated during build/dev:

- `.next/` - Next.js build output and cache
- `out/` - Static export output (if used)
- `node_modules/` - Dependencies
- `.env*` - Environment variables (keep sensitive data here)

## Code Quality Standards

### ESLint Configuration

Uses Next.js recommended ESLint configs:

- `eslint-config-next/core-web-vitals` - Performance and accessibility rules
- `eslint-config-next/typescript` - TypeScript-specific rules

Always run `npm run lint` before committing.

### TypeScript

All TypeScript errors must be resolved before building. The build will fail on type errors due to `strict: true` in tsconfig.json.
