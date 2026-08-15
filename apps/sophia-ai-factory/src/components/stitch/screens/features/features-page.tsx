'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/navigation';
import {
  Brain,
  Video,
  Coins,
  Globe,
} from 'lucide-react';

const FEATURE_ICONS: Record<string, React.ElementType> = {
  ai_engine: Brain,
  video_factory: Video,
  credits: Coins,
  api: Globe,
};

const FEATURE_KEYS = [
  'ai_engine',
  'video_factory',
  'credits',
  'api',
] as const;

export default function FeaturesPage() {
  const t = useTranslations('landing.features');

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
          {t('title')}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t('subtitle')}
        </p>
      </section>

      {/* Feature Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURE_KEYS.map((key) => {
            const Icon = FEATURE_ICONS[key] ?? Brain;
            return (
              <div
                key={key}
                className="group relative rounded-xl border border-border bg-card p-6 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {t(`items.${key}.title`)}
                    </h3>
                    <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {t(`items.${key}.badge`)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`items.${key}.description`)}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 text-center border-t border-border">
        <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
          Bắt đầu xây dựng đế chế video AI của bạn ngay hôm nay.
          <br />
          Start building your AI video empire today.
        </p>
        <Link
          href="/register"
          className="inline-block bg-primary text-primary-foreground font-bold px-8 py-3 rounded-lg hover:opacity-90 transition-all shadow-lg shadow-primary/20"
        >
          Bắt Đầu Ngay / Get Started
        </Link>
      </section>
    </main>
  );
}
