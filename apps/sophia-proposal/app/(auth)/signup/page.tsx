"use client";

import { SelfServeSignupForm } from "@/components/auth/self-serve-signup-form";

export default function SignupPage() {
  return (
    <div>
      {/* Page header */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Create your account
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Start building AI applications today
        </p>
      </div>

      {/* Self-serve onboarding form — calls POST /api/v1/onboard */}
      <SelfServeSignupForm />

      {/* Trust signals footer */}
      <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center gap-5 text-xs text-gray-500 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            Secure &amp; encrypted
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            No credit card required
          </span>
        </div>
      </div>
    </div>
  );
}
