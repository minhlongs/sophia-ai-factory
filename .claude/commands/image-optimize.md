---
description: 🖼️ Image Optimize — Compression, WebP/AVIF, Lazy Loading
argument-hint: [--quality=85] [--format=webp] [--max-width=1920]
---

**Think harder** để image optimize: <$ARGUMENTS>

**IMPORTANT:** Images PHẢI optimized — WebP/AVIF, lazy load, responsive srcset.

## CLI Tools

```bash
# === Install Sharp CLI ===
npm install -g sharp-cli

# === Convert to WebP ===
sharp input.jpg -o output.webp -q 85

# === Resize and Convert ===
sharp input.jpg -o output.webp -w 1920 -q 85

# === Bulk Convert ===
mogrify -format webp -quality 85 -path ./webp ./jpg/*.jpg

# === Compress PNG ===
pngquant --quality=65-80 --ext .png --force *.png

# === Optimize SVG ===
svgo *.svg
```

## Next.js Image Optimization

```tsx
import Image from 'next/image';

// Responsive image with WebP
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1920}
  height={1080}
  priority
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  quality={85}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>
```

## Vite Image Optimization

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
  plugins: [
    ViteImageOptimizer({
      png: { quality: 80 },
      jpeg: { quality: 85 },
      webp: { quality: 85, lossless: false },
      avif: { quality: 75 },
    }),
  ],
});
```

## Related Commands

- `/perf-audit` — Performance audit
- `/lighthouse` — Lighthouse audit
- `/bundle-analyze` — Bundle analysis
