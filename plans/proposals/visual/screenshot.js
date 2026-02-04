#!/usr/bin/env node

// Screenshot Generator for Visual Proposal
// Uses Playwright to capture PNG images from HTML

const { chromium } = require('playwright');
const path = require('path');

async function generateScreenshots() {
    console.log('🚀 Starting screenshot generation...');

    const browser = await chromium.launch();
    const page = await browser.newPage({
        viewport: { width: 1920, height: 1080 }
    });

    const htmlPath = 'file://' + path.resolve(__dirname, 'index.html');
    console.log(`📄 Loading: ${htmlPath}`);

    await page.goto(htmlPath, { waitUntil: 'networkidle' });

    // Full page screenshot
    console.log('📸 Capturing full page...');
    await page.screenshot({
        path: path.join(__dirname, 'proposal-full.png'),
        fullPage: true
    });

    // Cover slide
    console.log('📸 Capturing cover slide...');
    const coverSlide = await page.locator('.cover-slide');
    await coverSlide.screenshot({
        path: path.join(__dirname, '01-cover.png')
    });

    // Workflow diagram
    console.log('📸 Capturing workflow diagram...');
    const workflow = await page.locator('.workflow-section');
    await workflow.screenshot({
        path: path.join(__dirname, '02-workflow.png')
    });

    // Pricing table
    console.log('📸 Capturing pricing table...');
    const pricing = await page.locator('.pricing-section');
    await pricing.screenshot({
        path: path.join(__dirname, '03-pricing-table.png')
    });

    // Individual tier cards
    const tierCards = await page.locator('.tier-card').all();
    for (let i = 0; i < tierCards.length; i++) {
        console.log(`📸 Capturing tier ${i + 1}...`);
        await tierCards[i].screenshot({
            path: path.join(__dirname, `04-tier-${i + 1}.png`)
        });
    }

    // CTA section
    console.log('📸 Capturing CTA section...');
    const cta = await page.locator('.cta-section');
    await cta.screenshot({
        path: path.join(__dirname, '05-cta.png')
    });

    await browser.close();

    console.log('✅ Screenshot generation complete!');
    console.log('📁 Files saved in: ~/mekong-cli/plans/proposals/visual/');
}

generateScreenshots().catch(console.error);
