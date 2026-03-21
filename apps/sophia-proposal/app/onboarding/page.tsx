"use client";

import React from "react";
import { OrgSetupForm } from "@/components/onboarding/org-setup-form";

export default function OnboardingPage() {
  const handleOrgCreated = (orgId: string) => {
    window.location.href = `/dashboard`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface-container-low to-primary-container flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-surface-container-highest">
          <OrgSetupForm onSuccess={handleOrgCreated} />
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-surface-container-highest">
            <span className="material-symbols-outlined text-primary text-2xl mx-auto">speed</span>
            <p className="text-xs text-gray-600 mt-2">Deploy in minutes</p>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-surface-container-highest">
            <span className="material-symbols-outlined text-primary text-2xl mx-auto">security</span>
            <p className="text-xs text-gray-600 mt-2">Enterprise security</p>
          </div>
          <div className="p-4 bg-white rounded-xl shadow-sm border border-surface-container-highest">
            <span className="material-symbols-outlined text-primary text-2xl mx-auto">scale</span>
            <p className="text-xs text-gray-600 mt-2">Auto-scaling</p>
          </div>
        </div>
      </div>
    </div>
  );
}
