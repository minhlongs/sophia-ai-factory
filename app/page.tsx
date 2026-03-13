'use client';

import React from 'react';
import { Hero } from './components/sections/Hero';
import { Workflow } from './components/sections/Workflow';
import { Features } from './components/sections/Features';
import { AffiliateDiscovery } from './components/sections/AffiliateDiscovery';
import { Pricing } from './components/sections/Pricing';
import { TechStack } from './components/sections/TechStack';
import { ROICalculator } from './components/sections/ROICalculator';
import { Affiliates } from './components/sections/Affiliates';
import { FAQ } from './components/sections/FAQ';
import { Footer } from './components/sections/Footer';
import { MobileNav } from './components/layout/MobileNav';

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30">
      <MobileNav />
      <Hero />
      <Workflow />
      <TechStack />
      <Features />
      <AffiliateDiscovery />
      <Pricing />
      <ROICalculator />
      <Affiliates />
      <FAQ />
      <Footer />
    </main>
  );
}
