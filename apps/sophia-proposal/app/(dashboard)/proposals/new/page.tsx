"use client";

import React, { useState } from "react";
import AIGenerateForm from "@/components/proposals/ai-generate-form";

interface GeneratedProposal {
  executiveSummary: string;
  problemStatement: string;
  proposedSolution: string;
  timeline: string;
  investment: string;
  caseStudies: string;
  nextSteps: string;
}

export default function NewProposalPage() {
  const [generatedProposal, setGeneratedProposal] = useState<GeneratedProposal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = (proposal: GeneratedProposal) => {
    setGeneratedProposal(proposal);
    setError(null);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setGeneratedProposal(null);
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create New Proposal</h1>
        <p className="text-gray-600 mt-1">
          Generate a professional proposal using AI in under 30 seconds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Proposal Details</h2>
          <AIGenerateForm onSuccess={handleSuccess} onError={handleError} />
        </div>

        {/* Right: Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>

          {error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          ) : generatedProposal ? (
            <div className="prose prose-sm max-w-none">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Summary</h3>
              <div dangerouslySetInnerHTML={{ __html: generatedProposal.executiveSummary }} />

              <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Problem Statement</h3>
              <div dangerouslySetInnerHTML={{ __html: generatedProposal.problemStatement }} />

              <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Proposed Solution</h3>
              <div dangerouslySetInnerHTML={{ __html: generatedProposal.proposedSolution }} />

              <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Timeline</h3>
              <div dangerouslySetInnerHTML={{ __html: generatedProposal.timeline }} />

              <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Investment</h3>
              <div dangerouslySetInnerHTML={{ __html: generatedProposal.investment }} />

              <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">Next Steps</h3>
              <div dangerouslySetInnerHTML={{ __html: generatedProposal.nextSteps }} />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <span className="material-symbols-outlined text-4xl mb-2">description</span>
              <p>Fill in the form and click "Generate Proposal" to see a preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
