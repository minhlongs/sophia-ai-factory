"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface VideoGeneratorDialogProps {
  proposalId: string;
  onSuccess?: (videoId: string) => void;
  onClose: () => void;
}

export function VideoGeneratorDialog({
  proposalId,
  onSuccess,
  onClose,
}: VideoGeneratorDialogProps) {
  const [videoType, setVideoType] = useState<"intro" | "section" | "full_proposal" | "custom">(
    "intro"
  );
  const [scriptText, setScriptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mcuCost, setMcuCost] = useState<number | null>(null);

  // Calculate MCU cost based on video type
  const mcuCosts: Record<string, number> = {
    intro: 100,
    section: 250,
    full_proposal: 500,
    custom: 100,
  };

  const handleGenerate = async () => {
    if (!scriptText.trim()) {
      setError("Please enter a script");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proposalId,
          videoType,
          scriptText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate video");
      }

      setMcuCost(data.mcuCost);
      onSuccess?.(data.videoId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const getVideoTypeDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      intro: "30-second introduction video",
      section: "60-second section explanation",
      "full_proposal": "2-3 minute complete proposal overview",
      custom: "Custom length video",
    };
    return descriptions[type] || "";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Generate Video</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Video Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Video Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["intro", "section", "full_proposal", "custom"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setVideoType(type)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    videoType === type
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium capitalize">{type.replace("_", " ")}</div>
                  <div className="text-sm text-gray-500">
                    {getVideoTypeDescription(type)}
                  </div>
                  <div className="text-sm text-blue-600 mt-1">
                    {mcuCosts[type]} MCU
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Script Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Script <span className="text-red-500">*</span>
            </label>
            <textarea
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder="Enter the script for the AI avatar to read..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={5000}
            />
            <div className="text-sm text-gray-500 mt-1">
              {scriptText.length} / 5000 characters
            </div>
          </div>

          {/* Estimated Duration */}
          {scriptText.trim() && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                Estimated duration:{" "}
                <span className="font-medium">
                  {Math.ceil((scriptText.trim().split(/\s+/).length / 150) * 60)} seconds
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                MCU Cost: <span className="font-medium text-blue-600">{mcuCosts[videoType]} MCU</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isGenerating}>
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !scriptText.trim()}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                "Generate Video"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Video Generator Button Component
 */
export function VideoGenerator({ proposalId }: { proposalId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastGeneratedId, setLastGeneratedId] = useState<string | null>(null);

  const handleSuccess = (videoId: string) => {
    setLastGeneratedId(videoId);
    setIsOpen(false);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Generate Video
      </Button>

      {isOpen && (
        <VideoGeneratorDialog
          proposalId={proposalId}
          onSuccess={handleSuccess}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
