"use client";

import React, { useState } from "react";
import { generateProposalSchema } from "@/lib/validators/proposal";
import { getAllSystemTemplates } from "@/lib/ai/proposal-templates";

interface AIGenerateButtonProps {
  onSuccess?: (result: Record<string, string>) => void;
  onError?: (error: string) => void;
}

export default function AIGenerateButton({ onSuccess, onError }: AIGenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [quality, setQuality] = useState<{ score: number; passed: boolean } | null>(null);

  const templates = getAllSystemTemplates();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGenerating(true);
    setQuality(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: data.templateId as string,
          clientName: data.clientName as string,
          clientCompany: data.clientCompany as string,
          industry: data.industry as string,
          painPoints: (data.painPoints as string).split("\n").filter((p) => p.trim()),
          goals: (data.goals as string).split("\n").filter((g) => g.trim()),
          solutionDescription: data.solutionDescription as string,
          timeline: data.timeline as string,
          investment: data.investment as string,
          deliverables: (data.deliverables as string).split("\n").filter((d) => d.trim()),
          tone: data.tone as "professional" | "friendly" | "technical",
          length: data.length as "short" | "medium" | "long",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate proposal");
      }

      setQuality({
        score: result.quality.score,
        passed: result.quality.passed,
      });

      if (onSuccess) {
        onSuccess(result.proposal);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Template Selection */}
      <div>
        <label htmlFor="templateId" className="block text-sm font-medium text-gray-700">
          Proposal Template
        </label>
        <select
          id="templateId"
          name="templateId"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} - {template.industry}
            </option>
          ))}
        </select>
      </div>

      {/* Client Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="clientName" className="block text-sm font-medium text-gray-700">
            Client Name
          </label>
          <input
            type="text"
            id="clientName"
            name="clientName"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label htmlFor="clientCompany" className="block text-sm font-medium text-gray-700">
            Client Company
          </label>
          <input
            type="text"
            id="clientCompany"
            name="clientCompany"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
          Industry
        </label>
        <input
          type="text"
          id="industry"
          name="industry"
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Pain Points */}
      <div>
        <label htmlFor="painPoints" className="block text-sm font-medium text-gray-700">
          Pain Points (one per line)
        </label>
        <textarea
          id="painPoints"
          name="painPoints"
          rows={4}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="- Low conversion rate on landing page&#10;- High cart abandonment&#10;- Poor mobile experience"
        />
      </div>

      {/* Goals */}
      <div>
        <label htmlFor="goals" className="block text-sm font-medium text-gray-700">
          Goals (one per line)
        </label>
        <textarea
          id="goals"
          name="goals"
          rows={3}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="- Increase conversion by 50%&#10;- Reduce cart abandonment to &lt;60%&#10;- Launch mobile app"
        />
      </div>

      {/* Solution */}
      <div>
        <label htmlFor="solutionDescription" className="block text-sm font-medium text-gray-700">
          Solution Description
        </label>
        <textarea
          id="solutionDescription"
          name="solutionDescription"
          rows={3}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="timeline" className="block text-sm font-medium text-gray-700">
            Timeline
          </label>
          <input
            type="text"
            id="timeline"
            name="timeline"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="8 weeks"
          />
        </div>
        <div>
          <label htmlFor="investment" className="block text-sm font-medium text-gray-700">
            Investment Range
          </label>
          <input
            type="text"
            id="investment"
            name="investment"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="$10,000 - $15,000"
          />
        </div>
      </div>

      {/* Deliverables */}
      <div>
        <label htmlFor="deliverables" className="block text-sm font-medium text-gray-700">
          Deliverables (one per line)
        </label>
        <textarea
          id="deliverables"
          name="deliverables"
          rows={4}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="- Landing page redesign&#10;- A/B testing setup&#10;- Analytics dashboard"
        />
      </div>

      {/* Tone & Length */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="tone" className="block text-sm font-medium text-gray-700">
            Tone
          </label>
          <select
            id="tone"
            name="tone"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="technical">Technical</option>
          </select>
        </div>
        <div>
          <label htmlFor="length" className="block text-sm font-medium text-gray-700">
            Length
          </label>
          <select
            id="length"
            name="length"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="short">Short (1500-2000 words)</option>
            <option value="medium" selected>Medium (2500-3000 words)</option>
            <option value="long">Long (3500-4000 words)</option>
          </select>
        </div>
      </div>

      {/* Generate Button */}
      <button
        type="submit"
        disabled={isGenerating}
        className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            Generating Proposal...
          </>
        ) : (
          <>
            <span className="material-symbols-outlined mr-2">auto_awesome</span>
            Generate Proposal with AI
          </>
        )}
      </button>

      {/* Quality Result */}
      {quality && (
        <div
          className={`p-4 rounded-lg ${
            quality.passed ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"
          }`}
        >
          <div className="flex items-center">
            <span className="material-symbols-outlined mr-2 text-green-600">
              {quality.passed ? "check_circle" : "warning"}
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900">Quality Score: {quality.score}/100</p>
              <p className="text-xs text-gray-600">
                {quality.passed ? "Proposal meets quality standards" : "Review suggested before sending"}
              </p>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
