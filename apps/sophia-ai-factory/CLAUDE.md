# CLAUDE.md

<!-- CLEO:START -->

@.cleo/templates/AGENT-INJECTION.md

<!-- CLEO:END -->

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 GREEN PRODUCTION RULE — BẮT BUỘC TUYỆT ĐỐI

> **KHÔNG ĐƯỢC BÁO CÁO "DONE" KHI CHƯA VERIFY PRODUCTION GREEN!**
> Vi phạm rule này = toàn bộ task coi như THẤT BẠI.

**Sau mỗi `git push`, PHẢI chạy ĐỦ 3 bước:**

1. **CI/CD Check**: Poll `gh run list -L 1` cho đến khi `conclusion: success`
2. **Deploy Check**: `curl -sI "https://sophia-ai-factory.vercel.app" | head -3` → HTTP 200
3. **Smoke Test**: Verify production page loads correctly

**Report Format BẮT BUỘC:**

```
- Build: ✅/❌
- Tests: ✅/❌ [N tests]
- CI/CD: ✅/❌ [GitHub Actions status]
- Production: ✅/❌ HTTP [code]
```

**Thiếu bất kỳ dòng nào = task CHƯA XONG.**

```
PROD_URL="https://sophia-ai-factory.vercel.app"
GITHUB_REPO="longtho638-jpg/sophia-ai-factory"
```

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

---

## 🚀 AGENT TEAMS + BMAD (Feb 2026)

**Enabled:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

**Workflow:** `/plan:hard` → `"Gọi team thực hiện plan này"`

---

## 🚨 RULE: CI/CD GREEN PRODUCTION — KHÔNG ĐƯỢC DỪNG KHI CHƯA XONG

**Bắt buộc tuyệt đối — KHÔNG có ngoại lệ:**

1. **Build PHẢI pass:** `npm run build` — 0 errors
2. **Lint PHẢI pass:** `npm run lint` — 0 warnings/errors
3. **Tests PHẢI pass:** `npm test` — 100% green (nếu có test suite)
4. **Commit + Push:** `git add . && git commit && git push origin main`
5. **Deploy Production:** `npx vercel --prod` — PHẢI deploy thành công
6. **Verify Production:** Kiểm tra URL production hoạt động đúng

**KHÔNG ĐƯỢC báo "hoàn thành" nếu chưa qua đủ 6 bước trên.**
**KHÔNG ĐƯỢC dừng giữa chừng — phải chạy hết pipeline CI/CD → GREEN PRODUCTION.**
