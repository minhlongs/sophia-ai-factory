"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Rocket, Layout, BarChart3 } from "lucide-react";

const steps = [
  {
    icon: Layout,
    label: "Choose a Template",
    description: "Browse Templates",
    href: "/dashboard/create",
  },
  {
    icon: Rocket,
    label: "Create Campaign",
    description: "Configure & Launch",
    href: "/dashboard/create",
  },
  {
    icon: BarChart3,
    label: "Publish & Earn",
    description: "View Analytics",
    href: "/dashboard/analytics",
  },
];

export function OnboardingWelcomeBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sophia_onboarding_dismissed') === 'true';
  });

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem('sophia_onboarding_dismissed', 'true');
  }

  if (dismissed) return null;

  return (
    <div className="relative rounded-xl border border-[var(--neon-cyan)]/30 bg-gradient-to-r from-[var(--neon-cyan)]/5 to-[var(--neon-purple)]/5 p-6">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🚀</span>
        <h3 className="text-lg font-semibold text-foreground">
          Welcome to Sophia AI Factory!
        </h3>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Get started in 3 easy steps:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step, i) => (
          <Link
            key={step.href + i}
            href={step.href}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/50 p-3 hover:border-[var(--neon-cyan)]/50 transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)]">
              <step.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                {`${i + 1}. ${step.label}`}
              </div>
              <div className="text-xs text-muted-foreground">
                {step.description}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
