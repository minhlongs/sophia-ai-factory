"use client";

import { useState } from "react";
import { Card, CardContent } from "@/seed/components/ui/card";
import { Badge } from "@/seed/components/ui/badge";
import { FEATURE_FLAGS } from "@/seed/config/flags";
import type { FeatureFlag } from "@/seed/types";

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Record<FeatureFlag, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    Object.keys(FEATURE_FLAGS).forEach((key) => {
      initial[key] = FEATURE_FLAGS[key as FeatureFlag].defaultEnabled;
    });
    return initial as Record<FeatureFlag, boolean>;
  });

  const toggleFlag = (flag: FeatureFlag) => {
    setFlags((prev) => ({
      ...prev,
      [flag]: !prev[flag],
    }));
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Feature Flags</h1>
        <p className="text-muted-foreground">
          Control feature availability across tiers (visual simulation)
        </p>
      </div>

      {/* Info Banner */}
      <Card glass className="mb-8 border-primary/30 bg-primary/5">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">Note:</span>{" "}
            These toggles are for visual simulation only. In production, feature flags
            would be stored in a database and synced across the application.
          </p>
        </CardContent>
      </Card>

      {/* Flags Grid */}
      <div className="grid gap-6">
        {Object.entries(FEATURE_FLAGS).map(([key, config]) => {
          const flag = key as FeatureFlag;
          const isEnabled = flags[flag];

          return (
            <Card key={flag} glass className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {config.name}
                      </h3>
                      <Badge variant={isEnabled ? "premium" : "default"}>
                        {isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {config.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Required Tier:</span>
                      <Badge variant={
                        config.requiredTier === "ENTERPRISE" ? "enterprise" :
                        config.requiredTier === "PREMIUM" ? "premium" : "basic"
                      }>
                        {config.requiredTier}
                      </Badge>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <button
                    role="switch"
                    aria-checked={isEnabled}
                    aria-label={`Toggle ${config.name}`}
                    onClick={() => toggleFlag(flag)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled
                        ? "bg-[var(--neon-cyan)]"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                        isEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
