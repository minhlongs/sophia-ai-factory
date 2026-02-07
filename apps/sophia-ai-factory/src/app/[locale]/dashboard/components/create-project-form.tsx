"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
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
      const result = await createCampaign(formData);

      if (result.success) {
        router.push("/dashboard/campaigns");
        router.refresh();
      } else {
        setError(result.message || "Something went wrong");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="topic" className="block text-sm font-medium text-foreground">
          Video Topic
        </label>
        <input
          id="topic"
          name="topic"
          type="text"
          required
          placeholder="e.g. 5 ways to save money"
          className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground"
        />
        <p className="text-xs text-muted-foreground">What should this video be about?</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="audience" className="block text-sm font-medium text-foreground">
          Target Audience
        </label>
        <select
          id="audience"
          name="audience"
          required
          className="w-full px-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground"
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
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
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
