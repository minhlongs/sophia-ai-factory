/**
 * Generate branded OG images for Sophia AI Factory.
 * Outputs: public/twitter-card.png (1200x630), public/og-image.png (1200x630)
 *
 * Design: dark navy/teal gradient, Sophia brand identity.
 * Run: npx tsx scripts/generate-og-images.ts
 */

import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public')

const WIDTH = 1200
const HEIGHT = 630

/** Twitter card SVG — horizontal layout with logo mark on right */
function buildTwitterCardSvg(): string {
  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1e"/>
      <stop offset="50%" stop-color="#0d2137"/>
      <stop offset="100%" stop-color="#0a1a2e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#00a8cc"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <!-- Ambient circles -->
  <circle cx="80" cy="80" r="200" fill="#00d4ff" fill-opacity="0.04"/>
  <circle cx="${WIDTH - 60}" cy="${HEIGHT - 60}" r="250" fill="#0066cc" fill-opacity="0.06"/>
  <circle cx="600" cy="50" r="150" fill="#00ffcc" fill-opacity="0.03"/>
  <!-- Left accent bar -->
  <rect x="60" y="${HEIGHT / 2 - 160}" width="4" height="80" fill="url(#accent)" rx="2"/>
  <!-- Heading -->
  <text x="90" y="${HEIGHT / 2 - 100}" font-family="system-ui,-apple-system,sans-serif"
        font-size="52" font-weight="800" fill="#ffffff" letter-spacing="-1">Sophia</text>
  <text x="90" y="${HEIGHT / 2 - 40}" font-family="system-ui,-apple-system,sans-serif"
        font-size="52" font-weight="800" fill="url(#accent)" letter-spacing="-1">AI Factory</text>
  <!-- Tagline -->
  <text x="90" y="${HEIGHT / 2 + 30}" font-family="system-ui,-apple-system,sans-serif"
        font-size="24" font-weight="400" fill="#94a3b8" letter-spacing="1">
    Distribute Once, Earn Forever
  </text>
  <!-- Divider -->
  <rect x="60" y="${HEIGHT / 2 + 65}" width="${WIDTH - 120}" height="1" fill="#1e3a5f"/>
  <!-- Footer labels -->
  <text x="90" y="${HEIGHT / 2 + 120}" font-family="system-ui,-apple-system,sans-serif"
        font-size="16" font-weight="400" fill="#4a9ebb" letter-spacing="2">AI VIDEO FACTORY</text>
  <text x="${WIDTH - 90}" y="${HEIGHT / 2 + 120}" font-family="system-ui,-apple-system,sans-serif"
        font-size="16" font-weight="400" fill="#4a9ebb" text-anchor="end" letter-spacing="2">
    sophia.agencyos.network
  </text>
  <!-- Logo mark (right) -->
  <circle cx="${WIDTH - 140}" cy="${HEIGHT / 2 - 90}" r="80" fill="none"
          stroke="#00d4ff" stroke-width="1.5" stroke-opacity="0.3"/>
  <circle cx="${WIDTH - 140}" cy="${HEIGHT / 2 - 90}" r="55" fill="none"
          stroke="#00d4ff" stroke-width="1" stroke-opacity="0.5"/>
  <text x="${WIDTH - 140}" y="${HEIGHT / 2 - 75}" font-family="system-ui,-apple-system,sans-serif"
        font-size="42" fill="#00d4ff" text-anchor="middle" filter="url(#glow)">S</text>
  <text x="${WIDTH - 140}" y="${HEIGHT / 2 - 35}" font-family="system-ui,-apple-system,sans-serif"
        font-size="11" fill="#00d4ff" text-anchor="middle" fill-opacity="0.8" letter-spacing="1">SOPHIA</text>
</svg>`
}

/** OG image SVG — centered layout with feature badges */
function buildOgImageSvg(): string {
  return `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060d1f"/>
      <stop offset="45%" stop-color="#0b1d3a"/>
      <stop offset="100%" stop-color="#071525"/>
    </linearGradient>
    <linearGradient id="teal" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#00d4ff"/>
      <stop offset="100%" stop-color="#0099cc"/>
    </linearGradient>
    <linearGradient id="highlight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00d4ff" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0066cc" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#highlight)"/>
  <!-- Ambient glows -->
  <circle cx="900" cy="150" r="300" fill="#00d4ff" fill-opacity="0.05"/>
  <circle cx="100" cy="550" r="200" fill="#0066cc" fill-opacity="0.07"/>
  <!-- Top/bottom accent bars -->
  <rect x="0" y="0" width="${WIDTH}" height="4" fill="url(#teal)"/>
  <rect x="0" y="${HEIGHT - 4}" width="${WIDTH}" height="4" fill="url(#teal)"/>
  <!-- Main heading -->
  <text x="${WIDTH / 2}" y="220" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
        font-size="80" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="-2">Sophia</text>
  <text x="${WIDTH / 2}" y="310" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
        font-size="80" font-weight="900" fill="url(#teal)" text-anchor="middle" letter-spacing="-2">AI Factory</text>
  <!-- Divider -->
  <rect x="360" y="340" width="480" height="2" fill="#1e3a5f"/>
  <!-- Tagline -->
  <text x="${WIDTH / 2}" y="400" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
        font-size="26" font-weight="400" fill="#7cb9d4" text-anchor="middle" letter-spacing="2">
    DISTRIBUTE ONCE, EARN FOREVER
  </text>
  <!-- Domain -->
  <text x="${WIDTH / 2}" y="470" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
        font-size="18" font-weight="300" fill="#4a7a94" text-anchor="middle" letter-spacing="3">
    sophia.agencyos.network
  </text>
  <!-- Feature badges -->
  <rect x="80" y="540" width="200" height="36" rx="18" fill="#00d4ff" fill-opacity="0.12"/>
  <text x="180" y="563" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="600" fill="#00d4ff" text-anchor="middle" letter-spacing="1">AI VIDEO</text>
  <rect x="300" y="540" width="200" height="36" rx="18" fill="#0066cc" fill-opacity="0.15"/>
  <text x="400" y="563" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="600" fill="#60a5fa" text-anchor="middle" letter-spacing="1">USDT PAYOUTS</text>
  <rect x="520" y="540" width="200" height="36" rx="18" fill="#006644" fill-opacity="0.2"/>
  <text x="620" y="563" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="600" fill="#4ade80" text-anchor="middle" letter-spacing="1">9 NETWORKS</text>
  <rect x="740" y="540" width="200" height="36" rx="18" fill="#330066" fill-opacity="0.3"/>
  <text x="840" y="563" font-family="system-ui,-apple-system,sans-serif"
        font-size="13" font-weight="600" fill="#c084fc" text-anchor="middle" letter-spacing="1">6 CHANNELS</text>
</svg>`
}

async function generate(): Promise<void> {
  const twitterCardPath = path.join(PUBLIC_DIR, 'twitter-card.png')
  const ogImagePath = path.join(PUBLIC_DIR, 'og-image.png')

  console.log('Generating twitter-card.png ...')
  const twitterInfo = await sharp(Buffer.from(buildTwitterCardSvg()))
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(twitterCardPath)
  console.log(`twitter-card.png: ${twitterInfo.size} bytes`)

  console.log('Generating og-image.png ...')
  const ogInfo = await sharp(Buffer.from(buildOgImageSvg()))
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(ogImagePath)
  console.log(`og-image.png: ${ogInfo.size} bytes`)

  const MAX_SIZE = 200 * 1024 // 200KB
  if (twitterInfo.size > MAX_SIZE) throw new Error(`twitter-card.png too large: ${twitterInfo.size} bytes`)
  if (ogInfo.size > MAX_SIZE) throw new Error(`og-image.png too large: ${ogInfo.size} bytes`)

  console.log('OG images generated successfully.')
}

generate().catch((err: unknown) => {
  console.error('Failed to generate OG images:', err)
  process.exit(1)
})
