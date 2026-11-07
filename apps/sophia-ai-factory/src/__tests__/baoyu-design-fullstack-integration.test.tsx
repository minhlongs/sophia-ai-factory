/**
 * Full-Stack Verification Suite for 3-Tier Baoyu-Design × AgentKit Architecture (GH-122)
 *
 * Verifies:
 * 1. Tier B/C: `designs/sophia-ds` & `designs/sophia-opc-canvas` manifests and token parity with `.v3-core`.
 * 2. Tier C: `validatePaletteOklch()` WCAG contrast & perceptual OKLCH lightness separation.
 * 3. Tier A: Clean-room `<SophiaArtifactCanvas />` (side-by-side 9:16/16:9/1:1 artboards, Tweaks, Pin Comments)
 *    and `<DashboardSourcesDrawer />` (D1 table lineage & SHA-256 verification trace).
 * 4. Clean-Room License Gate: Zero Anthropic proprietary runtime/font files (`dc-runtime.js`, `anthropicons*`)
 *    inside `apps/sophia-ai-factory/src/` or `public/`.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import {
  hexToOklch,
  parseHexToSrgb,
  validatePaletteOklch,
  type BaoyuCanvasManifest,
  type BaoyuDesignSystemManifest,
  type BaoyuTokenCatalog,
} from '@/seed/baoyu-design';
import { SophiaArtifactCanvas } from '@/components/niche-studio/sophia-artifact-canvas';
import { DashboardSourcesDrawer } from '@/components/stitch/screens/dashboard/dashboard-sources-drawer';

const APP_ROOT = process.cwd();
const REPO_ROOT = path.resolve(APP_ROOT, '../..');

function collectFileNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFileNames(fullPath));
    } else {
      results.push(entry.name);
    }
  }
  return results;
}

describe('Tier B & C — Baoyu-Design Local Artifacts & Token Parity (GH-122)', () => {
  it('validates designs/sophia-ds/project/design-system.json and tokens.json against .v3-core', () => {
    const dsPath = path.join(REPO_ROOT, 'designs/sophia-ds/project/design-system.json');
    const tokensPath = path.join(REPO_ROOT, 'designs/sophia-ds/project/tokens.json');
    const v3CoreCss = fs.readFileSync(
      path.join(APP_ROOT, 'src/styles/v3-core.css'),
      'utf8',
    );

    const ds = JSON.parse(fs.readFileSync(dsPath, 'utf8')) as BaoyuDesignSystemManifest;
    const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8')) as BaoyuTokenCatalog;

    expect(ds.v).toBe(3);
    expect(ds.layout).toBe('files');
    expect(ds.namespace).toBe('SophiaDS');

    const surfaceToken = tokens.color.tokens.find((t) => t.name === 'surface');
    const accentToken = tokens.color.tokens.find((t) => t.name === 'accent');
    const amberToken = tokens.color.tokens.find((t) => t.name === 'accent-amber');

    expect(surfaceToken?.value.dark.toLowerCase()).toBe('#090a10');
    expect(accentToken?.value.dark.toLowerCase()).toBe('#6366f1');
    expect(amberToken?.value.dark.toLowerCase()).toBe('#f59e0b');
    expect(v3CoreCss.toLowerCase()).toContain('#090a10');
    expect(v3CoreCss.toLowerCase()).toContain('#6366f1');
    expect(v3CoreCss.toLowerCase()).toContain('#f59e0b');
  });

  it('validates designs/sophia-opc-canvas/project/canvas.json 3-artboard layout and installed design system', () => {
    const canvasPath = path.join(
      REPO_ROOT,
      'designs/sophia-opc-canvas/project/canvas.json',
    );
    const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8')) as BaoyuCanvasManifest;

    expect(canvas.v).toBe(3);
    expect(canvas.order).toEqual([
      'Main.dc.html',
      'NicheStudioCanvas.dc.html',
      'DashboardSources.dc.html',
    ]);
    // 80px horizontal spacing between 1280px artboards (0 -> 1360 -> 2720)
    expect(canvas.boards['Main.dc.html'].x).toBe(0);
    expect(canvas.boards['NicheStudioCanvas.dc.html'].x).toBe(1360);
    expect(canvas.boards['DashboardSources.dc.html'].x).toBe(2720);
    expect(canvas.designSystems[0]?.namespace).toBe('sophiads');
  });
});

describe('Tier C — OKLCH Dataviz Palette & Contrast Validator', () => {
  it('verifies WCAG AAA contrast and color-blind lightness separation for Sophia Dark & Light palettes', () => {
    const darkPrimary = validatePaletteOklch('#f1f5f9', '#090a10');
    expect(darkPrimary.wcagAA).toBe(true);
    expect(darkPrimary.wcagAAA).toBe(true);
    expect(darkPrimary.colorBlindSafe).toBe(true);
    expect(darkPrimary.contrastRatio).toBeGreaterThan(15);

    const lightPrimary = validatePaletteOklch('#0b0f19', '#f8f9fc');
    expect(lightPrimary.wcagAA).toBe(true);
    expect(lightPrimary.wcagAAA).toBe(true);
    expect(lightPrimary.colorBlindSafe).toBe(true);

    const amberOnDark = validatePaletteOklch('#f59e0b', '#090a10');
    expect(amberOnDark.wcagAA).toBe(true);
    expect(amberOnDark.colorBlindSafe).toBe(true);

    // 3-digit shorthand hex, neutral achromatic gray (C < 0.0001), and invalid hex fallback
    expect(parseHexToSrgb('#fff')).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHexToSrgb('#zzz')).toEqual({ r: 0, g: 0, b: 0 });
    expect(parseHexToSrgb('#zzzzzz')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToOklch('#000').h).toBe(0);
  });
});

describe('Tier A — Clean-Room React <SophiaArtifactCanvas /> & <DashboardSourcesDrawer />', () => {
  const mockT = (key: string) => key;

  it('renders side-by-side 9:16, 16:9, and 1:1 artboards in vi and en locales, updates Tweaks, and toggles Pin Comments', () => {
    const { rerender } = render(<SophiaArtifactCanvas t={mockT} />);

    expect(screen.getByTestId('sophia-artifact-canvas')).toBeDefined();
    expect(screen.getByTestId('baoyu-artboard-shorts_9_16')).toBeDefined();
    expect(screen.getByTestId('baoyu-artboard-youtube_16_9')).toBeDefined();
    expect(screen.getByTestId('baoyu-artboard-social_1_1')).toBeDefined();

    // Tweak 1: Switch accent color to #f59e0b
    const amberBtn = screen.getByTestId('baoyu-tweak-color-f59e0b');
    fireEvent.click(amberBtn);
    expect(amberBtn.getAttribute('aria-pressed')).toBe('true');

    // Tweak 2: Adjust display width range slider
    const widthSlider = screen.getByTestId('baoyu-tweak-width-slider');
    fireEvent.change(widthSlider, { target: { value: '108' } });
    expect(widthSlider.getAttribute('aria-valuetext')).toBe('108% width');

    // Tweak 3: Toggle compliance badge off and back on
    const complianceCheckbox = screen.getByTestId('baoyu-tweak-compliance-checkbox');
    expect(screen.getByTestId('baoyu-compliance-pill-shorts_9_16')).toBeDefined();
    fireEvent.click(complianceCheckbox);
    expect(screen.queryByTestId('baoyu-compliance-pill-shorts_9_16')).toBeNull();

    // Pin Comment: Resolve cmt-1
    const toggleCmt1 = screen.getByTestId('baoyu-comment-toggle-cmt-1');
    expect(toggleCmt1.textContent).toBe('baoyuCanvas.resolveBtn');
    fireEvent.click(toggleCmt1);
    expect(toggleCmt1.textContent).toBe('baoyuCanvas.reopenBtn');

    // Re-render in English locale to verify bilingual branches
    rerender(<SophiaArtifactCanvas t={mockT} locale="en" />);
    expect(screen.getByTestId('baoyu-artboard-shorts_9_16').textContent).toContain(
      'Hidden CEX trading fees',
    );
  });

  it('renders DashboardSourcesDrawer in both locales and expands D1 table lineage on toggle', () => {
    const { rerender } = render(<DashboardSourcesDrawer t={mockT} />);

    expect(screen.getByTestId('dashboard-sources-drawer')).toBeDefined();
    expect(screen.getByTestId('dashboard-sources-truth-state').textContent).toContain('LIVE');
    expect(screen.queryByTestId('dashboard-sources-table')).toBeNull();

    fireEvent.click(screen.getByTestId('dashboard-sources-toggle'));
    expect(screen.getByTestId('dashboard-sources-table')).toBeDefined();
    expect(screen.getByTestId('dashboard-source-row-src-revenue').textContent).toContain(
      'd1.affiliate_conversions',
    );

    rerender(<DashboardSourcesDrawer t={mockT} dataTruthState="live" isVi={false} />);
    expect(screen.getByTestId('dashboard-source-row-src-campaigns').textContent).toContain(
      'd1.campaigns',
    );
  });
});

describe('Clean-Room License Gate (NOTICE.md Section 2 Compliance)', () => {
  it('ensures zero Anthropic proprietary editor runtime or font files exist in src/ or public/', () => {
    const allFiles = [
      ...collectFileNames(path.join(APP_ROOT, 'src')),
      ...collectFileNames(path.join(APP_ROOT, 'public')),
    ];

    for (const fileName of allFiles) {
      const lower = fileName.toLowerCase();
      expect(lower).not.toContain('anthropicons');
      expect(lower).not.toBe('dc-runtime.js');
      expect(lower).not.toBe('fast-edit-worker.js');
    }
  });
});
