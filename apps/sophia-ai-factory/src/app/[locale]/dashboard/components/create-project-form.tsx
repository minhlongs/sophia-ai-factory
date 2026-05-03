"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaign } from "@/app/actions/campaigns";
import { createCampaignSchema } from "@/lib/campaigns/validation";
import { Button } from "@/seed/components/ui/button";
import { Loader2, Sparkles } from "lucide-react";

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);

    // Client-side Zod validation
    const rawData = {
      title: formData.get("topic") as string,
      topic: formData.get("topic") as string,
      audience: formData.get("audience") as string,
    };

    const validation = createCampaignSchema.safeParse(rawData);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as string;
        errors[field] = issue.message;
      }
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const result = await createCampaign(formData);

      if (result.success) {
        router.push("/dashboard/campaigns");
        router.refresh();
      } else {
        setError(result.message || "Đã xảy ra lỗi, vui lòng thử lại");
      }
    } catch {
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
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground ${
            fieldErrors.topic ? "border-destructive" : "border-input"
          }`}
        />
        {fieldErrors.topic ? (
          <p className="text-xs text-destructive">{fieldErrors.topic}</p>
        ) : (
          <p className="text-xs text-muted-foreground">What should this video be about?</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="audience" className="block text-sm font-medium text-foreground">
          Target Audience
        </label>
        <select
          id="audience"
          name="audience"
          required
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-background text-foreground ${
            fieldErrors.audience ? "border-destructive" : "border-input"
          }`}
        >
          <option value="">Chọn đối tượng...</option>
          <option value="entrepreneurs">Doanh nhân</option>
          <option value="students">Học sinh / Sinh viên</option>
          <option value="parents">Phụ huynh</option>
          <option value="tech-enthusiasts">Người yêu công nghệ</option>
          <option value="general">Đối tượng chung</option>
        </select>
        {fieldErrors.audience && (
          <p className="text-xs text-destructive">{fieldErrors.audience}</p>
        )}
      </div>

      {error && (
        <div role="alert" className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
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
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" aria-hidden="true" />
              Generate Script
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
