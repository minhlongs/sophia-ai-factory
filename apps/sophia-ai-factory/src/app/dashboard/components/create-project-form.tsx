"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { generateScript } from "@/app/actions/automation";
import { Button } from "@/app/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await generateScript(formData);

      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.message || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="topic" className="block text-sm font-medium text-gray-700">
          Video Topic
        </label>
        <input
          id="topic"
          name="topic"
          type="text"
          required
          placeholder="e.g. 5 ways to save money"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <p className="text-xs text-gray-500">What should this video be about?</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="audience" className="block text-sm font-medium text-gray-700">
          Target Audience
        </label>
        <select
          id="audience"
          name="audience"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
        >
          <option value="">Select an audience...</option>
          <option value="entrepreneurs">Entrepreneurs</option>
          <option value="students">Students</option>
          <option value="parents">Parents</option>
          <option value="tech-enthusiasts">Tech Enthusiasts</option>
          <option value="general">General Audience</option>
        </select>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          disabled={loading}
          className="min-w-[150px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Script
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
