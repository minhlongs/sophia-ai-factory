"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const verifyToken = async () => {
      const token = searchParams.get("token");
      const email = searchParams.get("email");

      if (!token || !email) {
        setStatus("error");
        setErrorMessage("Invalid or missing verification parameters");
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, email }),
        });

        if (res.ok) {
          setStatus("success");
          setTimeout(() => {
            window.location.href = "/onboarding";
          }, 2000);
        } else {
          const data = await res.json();
          setStatus("error");
          setErrorMessage(data.message || "Invalid or expired magic link");
        }
      } catch {
        setStatus("error");
        setErrorMessage("Network error. Please try again.");
      }
    };

    verifyToken();
  }, [searchParams]);

  return (
    <div className="text-center space-y-6">
      {status === "verifying" && (
        <>
          <div className="mx-auto w-16 h-16 bg-primary-container rounded-full flex items-center justify-center animate-pulse">
            <span className="material-symbols-outlined text-primary text-3xl">progress_activity</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Verifying your magic link</h2>
            <p className="text-sm text-gray-600 mt-2">Please wait a moment...</p>
          </div>
        </>
      )}

      {status === "success" && (
        <>
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-green-600 text-3xl">check_circle</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Successfully signed in!</h2>
            <p className="text-sm text-gray-600 mt-2">Redirecting to your dashboard...</p>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="mx-auto w-16 h-16 bg-error-container rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-3xl">error</span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Verification failed</h2>
            <p className="text-sm text-gray-600 mt-2">{errorMessage}</p>
          </div>
          <button
            onClick={() => router.push("/login")}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Back to login
          </button>
        </>
      )}
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-primary-container rounded-full flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-primary text-3xl">progress_activity</span>
        </div>
        <p className="text-sm text-gray-600">Loading...</p>
      </div>
    }>
      <MagicLinkContent />
    </Suspense>
  );
}
