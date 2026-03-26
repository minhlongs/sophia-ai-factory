"use client";

import React, { useState } from "react";

interface OrgSetupFormProps {
  onSuccess?: (orgId: string) => void;
}

interface FormErrors {
  orgName?: string;
  orgSlug?: string;
  role?: string;
  general?: string;
}

export function OrgSetupForm({ onSuccess }: OrgSetupFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    orgName: "",
    orgSlug: "",
    role: "founder",
    useCase: "",
  });

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData((prev) => ({ ...prev, orgName: name, orgSlug: slugify(name) }));
    if (errors.orgName) {
      setErrors((prev) => ({ ...prev, orgName: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.orgName.trim()) {
      newErrors.orgName = "Organization name is required";
    } else if (formData.orgName.trim().length < 2) {
      newErrors.orgName = "Name must be at least 2 characters";
    }

    if (!formData.orgSlug) {
      newErrors.orgSlug = "Organization slug is required";
    } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(formData.orgSlug)) {
      newErrors.orgSlug = "Slug can only contain lowercase letters, numbers, and hyphens";
    }

    if (!formData.role) {
      newErrors.role = "Please select your role";
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
      // Authenticated onboarding — creates org for current logged-in user
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create organization");
      }

      const data = await res.json();
      onSuccess?.(data.organization.id);
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : "Failed to create organization",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Set up your organization</h2>
        <p className="text-sm text-gray-600 mt-1">
          This is where you&apos;ll build and deploy AI applications
        </p>
      </div>

      <div>
        <label htmlFor="orgName" className="block text-sm font-medium text-gray-700">
          Organization Name
        </label>
        <input
          id="orgName"
          name="orgName"
          type="text"
          value={formData.orgName}
          onChange={handleOrgNameChange}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
            errors.orgName ? "border-error" : "border-gray-300"
          }`}
          placeholder="Acme AI Labs"
        />
        {errors.orgName && <p className="mt-1 text-sm text-error">{errors.orgName}</p>}
      </div>

      <div>
        <label htmlFor="orgSlug" className="block text-sm font-medium text-gray-700">
          Organization Slug
        </label>
        <div className="mt-1 flex rounded-lg shadow-sm">
          <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
            sophia.agencyos.network/
          </span>
          <input
            id="orgSlug"
            name="orgSlug"
            type="text"
            value={formData.orgSlug}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, orgSlug: slugify(e.target.value) }));
              if (errors.orgSlug) {
                setErrors((prev) => ({ ...prev, orgSlug: undefined }));
              }
            }}
            className={`flex-1 block w-full min-w-0 px-3 py-2 rounded-none rounded-r-lg border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
              errors.orgSlug ? "border-error" : "border-gray-300"
            }`}
            placeholder="acme-ai-labs"
          />
        </div>
        {errors.orgSlug && <p className="mt-1 text-sm text-error">{errors.orgSlug}</p>}
        <p className="mt-1 text-xs text-gray-500">
          This will be your unique workspace URL
        </p>
      </div>

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Your Role
        </label>
        <select
          id="role"
          name="role"
          value={formData.role}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, role: e.target.value }));
            if (errors.role) {
              setErrors((prev) => ({ ...prev, role: undefined }));
            }
          }}
          className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
            errors.role ? "border-error" : "border-gray-300"
          }`}
        >
          <option value="founder">Founder / CEO</option>
          <option value="cto">CTO / Technical Lead</option>
          <option value="developer">Developer</option>
          <option value="product">Product Manager</option>
          <option value="other">Other</option>
        </select>
        {errors.role && <p className="mt-1 text-sm text-error">{errors.role}</p>}
      </div>

      <div>
        <label htmlFor="useCase" className="block text-sm font-medium text-gray-700">
          What will you build? (optional)
        </label>
        <textarea
          id="useCase"
          name="useCase"
          value={formData.useCase}
          onChange={(e) => setFormData((prev) => ({ ...prev, useCase: e.target.value }))}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="Describe your AI project or use case..."
        />
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
        {isLoading ? "Creating..." : "Create Organization"}
      </button>
    </form>
  );
}
