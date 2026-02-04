"use client";

import { useState } from "react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { FEATURE_FLAGS } from "@/config/flags";
import type { FeatureFlag } from "@/types";

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
        <h1 className="text-3xl font-bold text-white mb-2">Feature Flags</h1>
        <p className="text-gray-400">
          Control feature availability across tiers (visual simulation)
        </p>
      </div>

      {/* Info Banner */}
      <Card glass className="mb-8 border-[var(--neon-cyan)]/30">
        <CardContent className="p-6">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-[var(--neon-cyan)]">Note:</span>{" "}
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
            <Card key={flag} glass>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">
                        {config.name}
                      </h3>
                      <Badge variant={isEnabled ? "premium" : "default"}>
                        {isEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      {config.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Required Tier:</span>
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
                    onClick={() => toggleFlag(flag)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled
                        ? "bg-[var(--neon-cyan)]"
                        : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
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
