"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FormData {
  name: string;
  email: string;
  company: string;
  agency_size: string;
  primary_use_case: string;
}

const AGENCY_SIZES = ["1-5", "6-20", "21-50", "50+"] as const;

export function PilotApplicationForm() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    company: "",
    agency_size: "",
    primary_use_case: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/v1/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          company: form.company,
          message: `Pilot: ${form.agency_size} people, ${form.primary_use_case}`,
        }),
      });
    } catch {
      // Non-blocking — show success regardless
    }
    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <div className="bg-surface-container rounded-2xl p-8 border border-outline-variant text-center">
        <span className="material-symbols-outlined text-5xl text-primary mb-4 block">check_circle</span>
        <h3 className="text-xl font-bold text-on-surface mb-2">Application Received!</h3>
        <p className="text-on-surface-variant">
          We&apos;ll review within 24 hours and reach out to schedule your onboarding call.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-container rounded-2xl p-8 border border-outline-variant space-y-5">
      <div>
        <label htmlFor="pilot-name" className="block text-sm font-medium text-on-surface mb-1.5">
          Full Name <span className="text-primary">*</span>
        </label>
        <input
          id="pilot-name"
          name="name"
          type="text"
          required
          value={form.name}
          onChange={handleChange}
          className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface placeholder:text-on-surface-variant/50"
          placeholder="Your name"
        />
      </div>

      <div>
        <label htmlFor="pilot-email" className="block text-sm font-medium text-on-surface mb-1.5">
          Work Email <span className="text-primary">*</span>
        </label>
        <input
          id="pilot-email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={handleChange}
          className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface placeholder:text-on-surface-variant/50"
          placeholder="you@agency.com"
        />
      </div>

      <div>
        <label htmlFor="pilot-company" className="block text-sm font-medium text-on-surface mb-1.5">
          Agency / Company <span className="text-primary">*</span>
        </label>
        <input
          id="pilot-company"
          name="company"
          type="text"
          required
          value={form.company}
          onChange={handleChange}
          className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface placeholder:text-on-surface-variant/50"
          placeholder="Acme Agency"
        />
      </div>

      <div>
        <label htmlFor="pilot-agency-size" className="block text-sm font-medium text-on-surface mb-1.5">
          Team Size <span className="text-primary">*</span>
        </label>
        <select
          id="pilot-agency-size"
          name="agency_size"
          required
          value={form.agency_size}
          onChange={handleChange}
          className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface"
        >
          <option value="">Select team size</option>
          {AGENCY_SIZES.map((size) => (
            <option key={size} value={size}>{size} people</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pilot-use-case" className="block text-sm font-medium text-on-surface mb-1.5">
          Primary Use Case <span className="text-primary">*</span>
        </label>
        <textarea
          id="pilot-use-case"
          name="primary_use_case"
          required
          rows={3}
          value={form.primary_use_case}
          onChange={handleChange}
          className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-on-surface placeholder:text-on-surface-variant/50 resize-none"
          placeholder="e.g. We want to automate proposal creation for our web design clients..."
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={loading}
        className="w-full glow-primary disabled:opacity-50"
      >
        {loading ? "Submitting..." : "Apply for Early Access"}
      </Button>

      <p className="text-xs text-on-surface-variant text-center">
        Only 10 spots available. No credit card required.
      </p>
    </form>
  );
}
