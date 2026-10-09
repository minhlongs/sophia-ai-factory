import React from 'react';
import { Link } from '@/navigation';
import { ArrowRight } from 'lucide-react';
import type { PageFeature } from './types';
import { resolveNicheIcon } from './icon-resolver';

/**
 * Niche Landing Page Hero & Features Sections
 *
 * @module components/landing/niche-page/landing-hero-features
 */

export function HeroSection({
  title,
  subtitle,
  ctaText,
  signupUrl,
}: {
  title: string;
  subtitle: string;
  ctaText: string;
  signupUrl: string;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 py-20 lg:py-28">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-8">
          {subtitle}
        </p>
        <Link
          href={signupUrl}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full text-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
        >
          {ctaText}
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </section>
  );
}

export function FeaturesSection({
  features,
  title,
}: {
  features: PageFeature[];
  title: string;
}) {
  return (
    <section className="py-20 bg-white dark:bg-gray-950">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
          {title}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
            >
              <div className="text-blue-600 dark:text-blue-400 mb-4">
                {resolveNicheIcon(feature.icon)}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
