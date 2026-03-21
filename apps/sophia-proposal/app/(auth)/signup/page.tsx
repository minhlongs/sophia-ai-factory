"use client";

import React, { useState } from "react";
import { SignupForm } from "@/components/auth/signup-form";
import { LoginForm } from "@/components/auth/login-form";

type AuthMode = "signup" | "login";

export default function SignupPage() {
  const [mode, setMode] = useState<AuthMode>("signup");

  const handleSuccess = () => {
    window.location.href = "/onboarding";
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {mode === "signup"
            ? "Start building AI applications today"
            : "Sign in to continue to your dashboard"}
        </p>
      </div>

      {mode === "signup" ? (
        <SignupForm
          onSuccess={handleSuccess}
          onSwitchToLogin={() => setMode("login")}
        />
      ) : (
        <LoginForm
          onSuccess={handleSuccess}
          onSwitchToSignup={() => setMode("signup")}
        />
      )}

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
          <span className="flex items-center">
            <span className="material-symbols-outlined text-xs mr-1">security</span>
            Secure authentication
          </span>
          <span className="flex items-center">
            <span className="material-symbols-outlined text-xs mr-1">lock</span>
            Encrypted data
          </span>
        </div>
      </div>
    </div>
  );
}
