"use client";

import React from "react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const handleSuccess = () => {
    window.location.href = "/dashboard";
  };

  const handleSwitchToSignup = () => {
    window.location.href = "/signup";
  };

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Sign in to Sophia</h2>
        <p className="text-sm text-gray-600 mt-1">
          Access your AI applications and dashboard
        </p>
      </div>

      <LoginForm
        onSuccess={handleSuccess}
        onSwitchToSignup={handleSwitchToSignup}
      />

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
