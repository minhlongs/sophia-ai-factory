"use client";

import { useState } from "react";
import Link from "next/link";

export default function DemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const data = new FormData(form);

    // Store in D1 via API
    try {
      await fetch("/api/v1/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          company: data.get("company"),
          message: data.get("message"),
        }),
      });
    } catch {
      // non-blocking — show success regardless (we capture the lead)
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-white flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-white text-3xl">smart_toy</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Book a Demo
          </h1>
          <p className="text-gray-600">
            See how Sophia AI Factory can automate proposals, content, and sales for your agency.
          </p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-green-200 text-center">
            <span className="material-symbols-outlined text-green-500 text-5xl mb-4 block">check_circle</span>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Request Received!</h2>
            <p className="text-gray-600 mb-6">
              We&apos;ll reach out within 24 hours to schedule your personalized demo.
            </p>
            <a
              href="/signup"
              className="inline-block bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-orange-600 transition-colors"
            >
              Start Free (200 MCU)
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="you@agency.com"
              />
            </div>
            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">Company / Agency</label>
              <input
                id="company"
                name="company"
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Acme Agency"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">What are you looking for?</label>
              <textarea
                id="message"
                name="message"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none"
                placeholder="AI proposals, content automation, sales tools..."
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Request Demo"}
            </button>
            <p className="text-xs text-gray-500 text-center">
              Or <Link href="/signup" className="text-orange-600 hover:underline font-medium">start free</Link> with 200 MCU credits — no credit card required.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
