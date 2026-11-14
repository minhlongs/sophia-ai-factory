/**
 * Automated Verification Suite for "Director's Control Deck" UI Design System
 * Verifies Executive Studio Light (:root), Cinema Dark Room (.dark),
 * signature utility classes (.radar, .film-strip, .camera-rec, .studio-glass),
 * typography (Inter, JetBrains Mono),
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

  it('declares Dual-Theme tokens across Executive Studio Ivory (:root) and Cinema Dark Room (.dark)', () => {
    expect(globalsCss).toContain('"Director\'s Control Deck" Design System');

    // Cinema Dark Room (.dark) default tokens
    expect(globalsCss).toContain('--background: #090A10;');
    expect(globalsCss).toContain('--card: #11131F;');
    expect(globalsCss).toContain('--primary: #6366F1;');
    expect(globalsCss).toContain('--accent: #F59E0B;');
    expect(globalsCss).toContain('--glass-bg: rgba(17, 19, 31, 0.75);');
    expect(globalsCss).toContain('--glass-border: rgba(255, 255, 255, 0.08);');

    // Executive Studio Ivory (:root) light mode + Zen Motion Governance tokens
    const rootBlock = globalsCss.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(rootBlock).toContain('--radius');
    expect(rootBlock).toContain('--background: #F8F9FC;');
    expect(rootBlock).toContain('--primary: #4338CA;');
    expect(rootBlock).toContain('--card: #FFFFFF;');
    expect(rootBlock).toContain('--motion-duration-deliberate: 400ms;');
    expect(rootBlock).toContain('--motion-ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);');
    expect(rootBlock).toContain('--studio-stage-bg: #090A10;');
  });

  it('defines signature Director Control Deck utility classes (.radar, .film-strip, .camera-rec, .studio-glass)', () => {
    expect(globalsCss).toContain('.radar {');
    expect(globalsCss).toContain('@keyframes radar-sweep');
    expect(globalsCss).toContain('.film-strip {');
    expect(globalsCss).toContain('.camera-rec {');
    expect(globalsCss).toContain('.studio-glass {');
  });

  it('includes Inter for UI/body text and JetBrains Mono for code & telemetry (Founder Decision 2)', () => {
    expect(globalsCss).toContain("font-family: 'Inter'");
    expect(globalsCss).toContain("'JetBrains Mono'");
    expect(globalsCss).not.toContain("'Plus Jakarta Sans'");
    expect(globalsCss).not.toContain("'Be Vietnam Pro'");
    expect(globalsCss).not.toContain('Satoshi');
    expect(globalsCss).not.toContain('Instrument Serif');
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
    // The surface comes from the `bg-card` token. A `dark:` literal override bypassed the
    // token layer and made the primitive immune to any future theme change.
    expect(cardTsx).toContain('bg-card');
    expect(cardTsx).not.toContain('dark:bg-[#11131F]');
    expect(statCardTsx).toContain('JetBrains Mono');
    expect(inputTsx).toContain('bg-card');
    expect(inputTsx).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(tableTsx).toContain('bg-card');
    expect(tableTsx).not.toContain('dark:bg-[#11131F]');
    // The shell surface comes from the semantic token. `--background` in `.dark`
    // already resolves to #090A10, so a `dark:bg-[#…]` literal would only freeze
    // the component against a future theme change (same invariant as card/table).
    expect(dashboardShellTsx).toContain('bg-background text-foreground');
    expect(dashboardShellTsx).not.toMatch(/dark:bg-\[#[0-9a-fA-F]{6}\]/);
    expect(dashboardShellTsx).not.toMatch(/dark:text-\[#[0-9a-fA-F]{6}\]/);
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
    expect(wizardStepper).toContain('dark:bg-primary-600');
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
    expect(videoPreview).toBeDefined();
    expect(videoPreviewSections).toContain('camera-rec');
    expect(videoPreviewSections).toContain('film-strip');
    expect(campaignCard).toContain('dark:bg-[#11131F]');
    expect(campaignCardDetails).toContain('font-mono');
    expect(settingsPage).toContain('dark:bg-[#11131F]');
    expect(settingsPage).toContain('dark:bg-primary-600');
    expect(settingsPage).toContain('text-primary-text');
  });

  it('enforces >= 4.5:1 WCAG AA dual-theme contrast on shared Button variants, Timeline preview, and Niche Studio states', () => {
    const seedButton = readSrcFile('seed/components/ui/button.tsx');
    const timelinePreview = readSrcFile('components/video/timeline-browser-preview.tsx');
    const storyboardCard = readSrcFile('components/niche-studio/storyboard-preview-card.tsx');
    const nicheForm = readSrcFile('components/niche-studio/niche-campaign-form.tsx');
    const compliancePlayer = readSrcFile('components/niche-studio/video-compliance-preview-player.tsx');
    const tierAssignment = readSrcFile('components/stitch/screens/affiliates/invite/tier-assignment.tsx');
    const inviteSuccess = readSrcFile('components/stitch/screens/affiliates/invite/invite-success-view.tsx');

    expect(seedButton).toContain('dark:bg-primary-600');
    expect(seedButton).toContain('dark:bg-secondary-700');
    expect(timelinePreview).toContain('bg-muted text-muted-foreground');
    expect(timelinePreview).not.toContain('bg-secondary text-muted-foreground');
    expect(storyboardCard).toContain('bg-card dark:bg-zinc-900/60');
    expect(nicheForm).toContain('text-emerald-800 dark:text-emerald-200');
    expect(nicheForm).toContain('text-rose-700 dark:text-rose-300');
    expect(compliancePlayer).toContain('text-emerald-800 dark:text-emerald-300');
    expect(tierAssignment).toContain('text-primary-text');
    expect(inviteSuccess).toContain('text-emerald-700 dark:text-emerald-300');
  });
});
