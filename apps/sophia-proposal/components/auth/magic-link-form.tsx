"use client";

import React, { useState } from "react";
import { useAuth } from "./auth-provider";

interface MagicLinkFormProps {
  onSuccess?: () => void;
}

export function MagicLinkForm({ onSuccess }: MagicLinkFormProps) {
  const { signInWithMagicLink } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; general?: string }>({});
  const [email, setEmail] = useState("");

  const validate = (): boolean => {
    const newErrors: { email?: string } = {};

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Invalid email format";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!validate()) return;

    setIsLoading(true);
    try {
      await signInWithMagicLink(email);
      setIsSent(true);
      onSuccess?.();
    } catch (error) {
      setErrors({ general: error instanceof Error ? error.message : "Failed to send magic link" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  if (isSent) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-primary-container rounded-full flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-2xl">mail</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Check your email</h3>
        <p className="text-sm text-gray-600">
          We&apos;ve sent a magic link to <strong>{email}</strong>
        </p>
        <p className="text-sm text-gray-500">
          Click the link in the email to sign in securely. The link expires in 15 minutes.
        </p>
        <button
          type="button"
          onClick={() => {
            setIsSent(false);
            setEmail("");
          }}
          className="text-primary hover:text-primary-hover font-medium text-sm"
        >
          Try another email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="text-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Sign in with magic link</h3>
        <p className="text-sm text-gray-600 mt-1">
          Enter your email and we&apos;ll send you a secure login link
        </p>
      </div>

      <div>
        <label htmlFor="magic-email" className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="magic-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={handleChange}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
            errors.email ? "border-error" : "border-gray-300"
          }`}
          placeholder="john@example.com"
        />
        {errors.email && <p className="mt-1 text-sm text-error">{errors.email}</p>}
      </div>

      {errors.general && (
        <div className="p-3 bg-error-container rounded-lg">
          <p className="text-sm text-error">{errors.general}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Sending..." : "Send magic link"}
      </button>

      <p className="text-xs text-center text-gray-500">
        No password needed. We&apos;ll email you a one-time login link.
      </p>
    </form>
  );
}
