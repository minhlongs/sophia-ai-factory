"use client";

import React, { useState } from "react";
import Link from "next/link";

interface FormData {
  orgName: string;
  email: string;
  password: string;
}

interface FormErrors {
  orgName?: string;
  email?: string;
  password?: string;
  general?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.orgName.trim()) errors.orgName = "Company or organization name is required";
  if (!data.email) {
    errors.email = "Email is required";
  } else if (!EMAIL_REGEX.test(data.email)) {
    errors.email = "Enter a valid email address";
  }
  if (!data.password) {
    errors.password = "Password is required";
  } else if (data.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }
  return errors;
}

const inputClass = (hasError: boolean) =>
  `block w-full px-3 py-2.5 border rounded-lg shadow-sm text-sm
   bg-white dark:bg-gray-900 text-gray-900 dark:text-white
   placeholder-gray-400 dark:placeholder-gray-500
   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
   transition-colors ${
     hasError ? "border-red-400 dark:border-red-600" : "border-gray-300 dark:border-gray-700"
   }`;

export function SelfServeSignupForm() {
  const [formData, setFormData] = useState<FormData>({ orgName: "", email: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiKeyDisplay, setApiKeyDisplay] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const validationErrors = validate(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_name: formData.orgName.trim(),
          email: formData.email,
          password: formData.password,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? body?.error ?? "Failed to create account");
      }
      const data = await res.json();
      // Store only non-sensitive org_id for UI use; never persist API keys in localStorage
      if (data?.org_id) localStorage.setItem("sophia_org_id", data.org_id);
      // Show API key once — user must copy it before being redirected
      if (data?.api_key) {
        setApiKeyDisplay(data.api_key);
        return; // redirect happens after user dismisses the key display
      }
      window.location.href = "/dashboard";
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // One-time API key display — shown after successful signup before redirect
  if (apiKeyDisplay) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
            Your API Key — copy it now
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
            This key will NOT be shown again. Store it securely.
          </p>
          <code className="block w-full p-2 rounded bg-white dark:bg-gray-900 border border-amber-300 dark:border-amber-600 text-xs font-mono break-all text-gray-900 dark:text-gray-100 select-all">
            {apiKeyDisplay}
          </code>
        </div>
        <button
          type="button"
          onClick={() => { window.location.href = "/dashboard"; }}
          className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white
            bg-gradient-to-r from-blue-500 to-purple-600
            hover:from-blue-600 hover:to-purple-700
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            transition-all shadow-sm"
        >
          I have saved my API key — Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errors.general && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
        </div>
      )}

      <div>
        <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Company or Organization Name
        </label>
        <input
          id="orgName" name="orgName" type="text" autoComplete="organization"
          value={formData.orgName} onChange={handleChange} placeholder="Acme Corp"
          className={inputClass(!!errors.orgName)}
        />
        {errors.orgName && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.orgName}</p>}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Work Email
        </label>
        <input
          id="email" name="email" type="email" autoComplete="email"
          value={formData.email} onChange={handleChange} placeholder="you@company.com"
          className={inputClass(!!errors.email)}
        />
        {errors.email && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Password
        </label>
        <input
          id="password" name="password" type="password" autoComplete="new-password"
          value={formData.password} onChange={handleChange} placeholder="Min. 8 characters"
          className={inputClass(!!errors.password)}
        />
        {errors.password && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>}
      </div>

      <button
        type="submit" disabled={isLoading}
        className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white
          bg-gradient-to-r from-blue-500 to-purple-600
          hover:from-blue-600 hover:to-purple-700
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Creating account…
          </span>
        ) : (
          "Create Account"
        )}
      </button>

      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          Sign in
        </Link>
      </p>
    </form>
  );
}
