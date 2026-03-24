"use client";

import React, { useState } from "react";

interface ProposalSection {
  key: string;
  title: string;
  content: string;
  aiGenerated: boolean;
}

interface ProposalEditorProps {
  proposalId?: string;
  initialContent?: Record<string, string>;
  onSave?: (content: Record<string, string>) => void;
}

export default function ProposalEditor({
  proposalId,
  initialContent = {},
  onSave,
}: ProposalEditorProps) {
  const [sections, setSections] = useState<ProposalSection[]>([
    {
      key: "executiveSummary",
      title: "Executive Summary",
      content: initialContent.executiveSummary || "",
      aiGenerated: true,
    },
    {
      key: "problemStatement",
      title: "Problem Statement",
      content: initialContent.problemStatement || "",
      aiGenerated: true,
    },
    {
      key: "proposedSolution",
      title: "Proposed Solution",
      content: initialContent.proposedSolution || "",
      aiGenerated: true,
    },
    {
      key: "timeline",
      title: "Timeline",
      content: initialContent.timeline || "",
      aiGenerated: true,
    },
    {
      key: "investment",
      title: "Investment",
      content: initialContent.investment || "",
      aiGenerated: true,
    },
    {
      key: "nextSteps",
      title: "Next Steps",
      content: initialContent.nextSteps || "",
      aiGenerated: true,
    },
  ]);

  const [editingSection, setEditingSection] = useState<string | null>(null);

  const handleContentChange = (key: string, content: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.key === key
          ? { ...section, content, aiGenerated: false }
          : section
      )
    );
  };

  const handleRegenerate = async (_key: string) => {
    // Regenerate section — not yet implemented
  };

  const handleSave = () => {
    const content = Object.fromEntries(
      sections.map((s) => [s.key, s.content])
    );
    onSave?.(content);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Proposal Editor</h2>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover focus:ring-2 focus:ring-primary focus:outline-none"
          >
            Save Changes
          </button>
        </div>
      </div>

      {sections.map((section) => (
        <div
          key={section.key}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">{section.title}</h3>
            <div className="flex items-center gap-2">
              {section.aiGenerated && (
                <span className="text-xs text-gray-500">AI-generated</span>
              )}
              <button
                onClick={() => setEditingSection(editingSection === section.key ? null : section.key)}
                className="text-xs text-primary hover:text-primary-hover focus:ring-2 focus:ring-primary focus:outline-none rounded"
              >
                {editingSection === section.key ? "Preview" : "Edit"}
              </button>
              <button
                onClick={() => handleRegenerate(section.key)}
                className="text-xs text-gray-500 hover:text-gray-700 focus:ring-2 focus:ring-primary focus:outline-none rounded"
              >
                Regenerate
              </button>
            </div>
          </div>
          <div className="p-4">
            {editingSection === section.key ? (
              <textarea
                value={section.content}
                onChange={(e) => handleContentChange(section.key, e.target.value)}
                rows={6}
                className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: section.content || "<em>Empty section</em>" }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
