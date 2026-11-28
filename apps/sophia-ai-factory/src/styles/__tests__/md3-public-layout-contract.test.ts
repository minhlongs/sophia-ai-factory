import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd());
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Sophia MD3 Canonical Public Layout & Touch-Target Contract', () => {
  const md3Css = read('src/styles/md3-expressive-modern-web.css');
  const affiliateView = read('src/app/[locale]/affiliate/components/affiliate-landing-view.tsx');
  const mobileDrawer = read('src/components/stitch/layouts/marketing-nav-mobile-drawer.tsx');
  const footerLinks = read('src/components/stitch/layouts/marketing-footer-link-columns.tsx');

  it('defines canonical 1040px marketing, 780px article, and 1280px wide containers with min-width: 0', () => {
    expect(md3Css).toContain('.md3-pane-container');
    expect(md3Css).toContain('max-width: 1040px;');
    expect(md3Css).toContain('min-width: 0;');
    expect(md3Css).toContain('.md3-article-container');
    expect(md3Css).toContain('max-width: 780px;');
    expect(md3Css).toContain('.md3-wide-container');
    expect(md3Css).toContain('max-width: 1280px;');
  });

  it('defines shared .md3-touch-target (>= 44x44 CSS px) and applies it to mobile nav & footer', () => {
    expect(md3Css).toContain('.md3-touch-target');
    expect(md3Css).toContain('min-height: 44px;');
    expect(md3Css).toContain('min-width: 44px;');
    expect(mobileDrawer).toContain('md3-touch-target');
    expect(footerLinks).toContain('md3-touch-target');
  });

  it('uses <main className="md3-pane-container ..."> in AffiliateLandingView to prevent flex-col table overflow', () => {
    expect(affiliateView).toContain('<main className="md3-pane-container');
    expect(affiliateView).not.toContain('max-w-4xl mx-auto px-4');
  });
});
