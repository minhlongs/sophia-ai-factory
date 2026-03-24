"use client";

import React, { useState, use } from "react";
import ProposalEditor from "@/components/proposals/proposal-editor";
import PDFExportButton, { exportProposalToPDF } from "@/lib/pdf/generator";

export default function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  // Mock data - will be replaced with API call
  const [proposalData, setProposalData] = useState({
    clientName: "John Smith",
    clientCompany: "Acme Corp",
    executiveSummary: "This is a sample executive summary...",
    problemStatement: "The client is facing challenges with...",
    proposedSolution: "We propose a comprehensive solution...",
    timeline: "8 weeks total duration...",
    investment: "$10,000 - $15,000",
    nextSteps: "Schedule a call to discuss...",
  });

  const handleSave = (content: Record<string, string>) => {
    setProposalData((prev) => ({ ...prev, ...content }));
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Proposal for {proposalData.clientName}
          </h1>
          <p className="text-gray-600 mt-1">{proposalData.clientCompany}</p>
        </div>
        <div className="flex gap-2">
          <PDFExportButton proposalData={proposalData} />
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Back to List
          </button>
        </div>
      </div>

      <ProposalEditor
        initialContent={{
          executiveSummary: proposalData.executiveSummary,
          problemStatement: proposalData.problemStatement,
          proposedSolution: proposalData.proposedSolution,
          timeline: proposalData.timeline,
          investment: proposalData.investment,
          nextSteps: proposalData.nextSteps,
        }}
        onSave={handleSave}
      />
    </div>
  );
}
