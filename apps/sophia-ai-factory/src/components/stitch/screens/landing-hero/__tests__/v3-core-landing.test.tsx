/**
 * Verification Suite for .v3-core Sophia Edition (agentkit.best/vi Style) — GH-117
 * Verifies:
 * 1. src/styles/v3-core.css tokens, variable typography (Archivo wdth 104),
 *    sticky chapter panels, outlined stroke pain numbers, and reduced-motion fallbacks.
 * 2. SophiaAgentChatReplay live command & chat trace (YOU <-> SOPHIA) in VI and EN.
 * 3. Scrollytelling chapters (#hero, #why, #how, #ecosystem, #join) and runtime ticker.
 * 4. Harmonization across GuidePage, DashboardPage, NicheStudioHeader, and DataStateBoundary.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import viMessages from '../../../../../../messages/vi.json';
import enMessages from '../../../../../../messages/en.json';
import { SophiaAgentChatReplay } from '../modular/sophia-agent-chat-replay';

const ROOT = process.cwd();

function readAppFile(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

describe('.v3-core Sophia Edition CSS & Font Architecture (GH-117)', () => {
  const v3CoreCss = readAppFile('src/styles/v3-core.css');
  const globalsCss = readAppFile('src/app/globals.css');
  const rootLayout = readAppFile('src/app/layout.tsx');

  it('defines .v3-core Obsidian/Indigo/Amber tokens and Archivo variable font settings', () => {
    expect(v3CoreCss).toContain('.v3-core {');
    expect(v3CoreCss).toContain('--bg: #090A10;');
    expect(v3CoreCss).toContain('--accent: #6366F1;');
    expect(v3CoreCss).toContain('--accent-2: #F59E0B;');
    expect(v3CoreCss).toContain('--ease: cubic-bezier(0.16, 1, 0.3, 1);');
    expect(v3CoreCss).toContain('font-variation-settings: "wdth" 104;');
  });

  it('defines signature agentkit.best/vi classes (.eyebrow, .h1-a, .h1-b, .chapter, .panel, .pains .num, .turn, .cmd-line, .chat, .runtimes)', () => {
    for (const selector of [
      '.v3-core .eyebrow',
      '.v3-core .dot',
      '.v3-core .h1-a',
      '.v3-core .h1-b',
      '.v3-core .btn-primary',
      '.v3-core .chapter',
      '.v3-core .panel',
      '.v3-core .pains .num',
      '-webkit-text-stroke: 1.2px var(--accent)',
      '.v3-core .turn',
      '.v3-core .cmd-line',
      '.v3-core .chat',
      '.v3-core .runtimes',
      '@media (prefers-reduced-motion: reduce)',
    ]) {
      expect(v3CoreCss).toContain(selector);
    }
  });

  it('imports v3-core.css in globals.css and loads Archivo variable font in RootLayout', () => {
    expect(globalsCss).toContain('@import "../styles/v3-core.css";');
    expect(rootLayout).toContain('Archivo:wdth,wght@100..112,400..800');
    expect(rootLayout).toContain('Inter:wght@400;500;600;700;800');
    expect(rootLayout).toContain('JetBrains+Mono:wght@400;500;600');
  });
});

describe('SophiaAgentChatReplay component (YOU <-> SOPHIA trace)', () => {
  it('renders command prompt and YOU <-> SOPHIA conversation in Vietnamese', () => {
    render(
      <NextIntlClientProvider locale="vi" messages={{ stitch: viMessages.stitch }}>
        <SophiaAgentChatReplay />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId('sophia-agent-chat-replay')).toBeDefined();
    expect(
      screen.getByText('/sophia launch --niche crypto_cex --offer binance-vip --gate sha256'),
    ).toBeDefined();
    expect(screen.getAllByText('YOU').length).toBe(2);
    expect(screen.getAllByText('SOPHIA').length).toBe(2);
    expect(screen.getByText(viMessages.stitch.landing.v3Core.chatSophia2)).toBeDefined();
  });

  it('renders command prompt and YOU <-> SOPHIA conversation in English', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ stitch: enMessages.stitch }}>
        <SophiaAgentChatReplay />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(enMessages.stitch.landing.v3Core.chatYou1)).toBeDefined();
    expect(screen.getByText(enMessages.stitch.landing.v3Core.chatSophia2)).toBeDefined();
  });
});

describe('Scrollytelling Chapters & Cross-Surface Harmonization (Landing, Guide, Dashboard)', () => {
  const landingView = readAppFile(
    'src/components/stitch/screens/landing-hero/modular/landing-hero-view.tsx',
  );
  const heroHeader = readAppFile(
    'src/components/stitch/screens/landing-hero/modular/hero-header.tsx',
  );
  const workflowAndFeatures = readAppFile(
    'src/components/stitch/screens/landing-hero/modular/workflow-and-features.tsx',
  );
  const faqAndCta = readAppFile(
    'src/components/stitch/screens/landing-hero/modular/faq-and-cta.tsx',
  );
  const guidePage = readAppFile('src/app/[locale]/guide/page.tsx');
  const dashboardPage = readAppFile(
    'src/components/stitch/screens/dashboard/dashboard-page.tsx',
  );
  const nicheHeader = readAppFile('src/components/niche-studio/niche-studio-header.tsx');
  const dataBoundary = readAppFile('src/components/stitch/ui/data-state-boundary.tsx');

  it('wires #hero, #why, #how, #ecosystem, #join chapters and runtime ticker on the Landing Page', () => {
    expect(landingView).toContain('v3-core');
    expect(landingView).toContain('id="hero"');
    expect(landingView).toContain('className="runtimes');
    expect(heroHeader).toContain('className="eyebrow"');
    expect(heroHeader).toContain('className="h1-a"');
    expect(heroHeader).toContain('className="h1-b"');
    expect(heroHeader).toContain('btn btn-lg btn-primary');
    expect(workflowAndFeatures).toContain('id="why"');
    expect(workflowAndFeatures).toContain('className="pains"');
    expect(workflowAndFeatures).toContain('className="turn"');
    expect(workflowAndFeatures).toContain('id="how"');
    expect(workflowAndFeatures).toContain('<SophiaAgentChatReplay />');
    expect(workflowAndFeatures).toContain('id="ecosystem"');
    expect(faqAndCta).toContain('id="join"');
  });

  it('applies .v3-core telemetry eyebrows and container scope across Guide, Dashboard, NicheStudio, and DataStateBoundary', () => {
    expect(guidePage).toContain('v3-core');
    expect(guidePage).toContain('eyebrow');
    expect(dashboardPage).toContain('v3-core');
    expect(dashboardPage).toContain('eyebrow');
    expect(dashboardPage).toContain('DataStateBoundary');
    expect(dashboardPage).toContain('dashboard-data-boundary');
    expect(nicheHeader).toContain('v3-core');
    expect(dataBoundary).toContain('v3-core');
  });
});
