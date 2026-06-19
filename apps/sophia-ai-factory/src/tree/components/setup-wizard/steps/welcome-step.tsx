"use client";

import React from 'react';
import { useTranslations } from 'next-intl';
import { Rocket, Key, Shield, ArrowRight } from 'lucide-react';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  const t = useTranslations('setupWizard.welcome');

  const features = [
    {
      icon: Key,
      title: t('features.keys.title'),
      description: t('features.keys.description'),
    },
    {
      icon: Shield,
      title: t('features.security.title'),
      description: t('features.security.description'),
    },
    {
      icon: Rocket,
      title: t('features.launch.title'),
      description: t('features.launch.description'),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-3">
          {t('title')}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature, index) => (
          <div
            key={index}
            className="flex flex-col items-center text-center p-6 rounded-xl border border-border bg-card hover:shadow-md transition-all duration-300"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <feature.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">
              {feature.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-muted/30 rounded-lg p-6 border border-border">
        <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <span className="text-lg">📋</span>
          {t('whatYouNeed.title')}
        </h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {t.raw('whatYouNeed.items').map((item: string, index: number) => (
            <li key={index} className="flex items-start gap-2">
              <CheckIcon className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
        >
          {t('getStarted')}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
