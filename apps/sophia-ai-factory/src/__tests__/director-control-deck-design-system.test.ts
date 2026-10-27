/**
 * Automated Verification Suite for "Director's Control Deck" UI Design System
 * Verifies Executive Studio Light (:root), Cinema Dark Room (.dark),
 * signature utility classes (.radar, .film-strip, .camera-rec, .studio-glass),
 * typography (Plus Jakarta Sans, Be Vietnam Pro, JetBrains Mono),
 * and adaptive Light/Dark tokens across all 4 modernized screen groups.
 *
 * @module src/__tests__/director-control-deck-design-system
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_SRC = path.resolve(__dirname, '..');

function readSrcFile(relPath: string): string {
  return fs.readFileSync(path.join(APP_SRC, relPath), 'utf8');
}

describe("Director's Control Deck Design System Verification", () => {
  const globalsCss = readSrcFile('app/globals.css');

  it('defines Executive Studio Light (:root) and Cinema Dark Room (.dark) tokens in globals.css', () => {
    expect(globalsCss).toContain('"Director\'s Control Deck" Design System');
    // Executive Studio Light (:root)
    expect(globalsCss).toContain('--background: 220 27% 98%;');
    expect(globalsCss).toContain('--foreground: 228 63% 8%;');
    expect(globalsCss).toContain('--card: 0 0% 100%;');
    expect(globalsCss).toContain('--primary: 243 75% 48%;');
    expect(globalsCss).toContain('--accent: 37 91% 44%;');
    expect(globalsCss).toContain('--border: 214 32% 91%;');

    // Cinema Dark Room (.dark)
    expect(globalsCss).toContain('--background: 234 53% 4%;');
    expect(globalsCss).toContain('--card: 233 29% 9%;');
    expect(globalsCss).toContain('--primary: 239 84% 67%;');
    expect(globalsCss).toContain('--accent: 38 92% 50%;');
    expect(globalsCss).toContain('--glass-bg: rgba(17, 19, 31, 0.75);');
    expect(globalsCss).toContain('--glass-border: rgba(255, 255, 255, 0.08);');
  });

  it('defines signature Director Control Deck utility classes (.radar, .film-strip, .camera-rec, .studio-glass)', () => {
    expect(globalsCss).toContain('.radar {');
    expect(globalsCss).toContain('@keyframes radar-sweep');
    expect(globalsCss).toContain('.film-strip {');
    expect(globalsCss).toContain('.camera-rec {');
    expect(globalsCss).toContain('.studio-glass {');
  });

  it('includes Plus Jakarta Sans and Be Vietnam Pro in body font stack', () => {
    expect(globalsCss).toContain("'Plus Jakarta Sans'");
    expect(globalsCss).toContain("'Be Vietnam Pro'");
  });

  it('Phase 1: upgrades core Stitch UI primitives and Navigation Shells to adaptive Light/Dark', () => {
    const buttonTsx = readSrcFile('components/stitch/ui/button.tsx');
    const buttonStylesTs = readSrcFile('components/stitch/ui/button-styles.ts');
    const cardTsx = readSrcFile('components/stitch/ui/card.tsx');
    const statCardTsx = readSrcFile('components/stitch/ui/stat-card.tsx');
    const inputTsx = readSrcFile('components/stitch/ui/input.tsx');
    const tableTsx = readSrcFile('components/stitch/ui/table.tsx');
    const dashboardShellTsx = readSrcFile('forest/dashboard/dashboard-shell.tsx');
    const marketingNavTsx = readSrcFile('components/stitch/layouts/marketing-nav.tsx');

    expect(buttonStylesTs).toContain('bg-primary text-primary-foreground');
    expect(buttonTsx).not.toContain('via-indigo-500 to-violet-600');
    expect(cardTsx).toContain('dark:bg-[#11131F]');
    expect(statCardTsx).toContain('JetBrains Mono');
    expect(inputTsx).toContain('dark:bg-[#11131F]');
    expect(tableTsx).toContain('dark:bg-[#11131F]');
    expect(dashboardShellTsx).toContain('dark:bg-[#090A10]');
    expect(marketingNavTsx).toContain('studio-glass');
  });

  it('Phase 2: upgrades Landing Hero, Pricing, Login, and Register to adaptive Light/Dark & Director utilities', () => {
    const landingView = readSrcFile('components/stitch/screens/landing-hero/modular/landing-hero-view.tsx');
    const pipelineMockup = readSrcFile('components/stitch/screens/landing-hero/modular/pipeline-mockup.tsx');
    const pricingView = readSrcFile('components/stitch/screens/pricing/view/pricing-page-view.tsx');
    const pricingCard = readSrcFile('components/stitch/screens/pricing/view/pricing-card.tsx');
    const loginPage = readSrcFile('components/stitch/screens/login/login-page.tsx');
    const registerView = readSrcFile('components/stitch/screens/auth/register/register-page-view.tsx');

    expect(landingView).toContain('bg-[#F8F9FC] dark:bg-[#090A10]');
    // The landing preview is illustrative — no REC/LIVE decoration. The
    // `camera-rec` utility still exists for real studio previews (Phase 4).
    expect(pipelineMockup).not.toContain('camera-rec');
    expect(
      readSrcFile('components/stitch/screens/landing-hero/modular/pipeline-mockup-header.tsx'),
    ).toContain('ILLUSTRATIVE PREVIEW');
    expect(pipelineMockup).toContain('film-strip');
    expect(pricingView).toContain('bg-[#F8F9FC] dark:bg-[#090A10]');
    expect(pricingCard).toContain('font-mono');
    expect(loginPage).toContain('bg-[#F8F9FC] dark:bg-[#090A10]');
    expect(registerView).toContain('bg-[#F8F9FC] dark:bg-[#090A10]');
  });

  it('Phase 3: upgrades Setup Wizard stepper and BYOK cards while preserving Protected Flow attributes', () => {
    const wizardStepper = readSrcFile('tree/components/setup-wizard/wizard-stepper.tsx');
    const apiKeyInput = readSrcFile('tree/components/setup-wizard/api-key-input.tsx');
    const byokBanner = readSrcFile('tree/components/setup-wizard/byok-doctrine-banner.tsx');

    expect(wizardStepper).toContain('font-mono');
    expect(apiKeyInput).toContain('dark:bg-[#11131F]');
    expect(byokBanner).toContain('AES-256-GCM');
  });

  it('Phase 4: upgrades Dashboard, Video Studio, Campaigns, and Settings to Director Control Deck', () => {
    const dashboardPage = readSrcFile('components/stitch/screens/dashboard/dashboard-page.tsx');
    const videoPreview = readSrcFile('components/stitch/screens/video-creation/video-preview-sidebar.tsx');
    const videoPreviewSections = readSrcFile('components/stitch/screens/video-creation/video-preview-sections.tsx');
    const campaignCard = readSrcFile('components/stitch/screens/campaigns/campaign-card.tsx');
    const campaignCardDetails = readSrcFile('components/stitch/screens/campaigns/campaign-card-details.tsx');
    const settingsPage = readSrcFile('components/stitch/screens/settings/settings-page.tsx');

    expect(dashboardPage).toContain('text-foreground dark:text-white');
    expect(videoPreviewSections).toContain('camera-rec');
    expect(videoPreviewSections).toContain('film-strip');
    expect(campaignCard).toContain('dark:bg-[#11131F]');
    expect(campaignCardDetails).toContain('font-mono');
    expect(settingsPage).toContain('dark:bg-[#11131F]');
  });
});
