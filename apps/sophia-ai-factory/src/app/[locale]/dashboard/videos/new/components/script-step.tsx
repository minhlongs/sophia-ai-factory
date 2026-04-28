"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { ScriptContent } from "./video-creator-wizard";

interface ScriptStepProps {
  onDone: (content: ScriptContent) => void;
}

export function ScriptStep({ onDone }: ScriptStepProps) {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [durationSec, setDurationSec] = useState(30);
  const [content, setContent] = useState<ScriptContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, audience, durationSec }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Script generation failed (${res.status})`);
      }
      const data = (await res.json()) as { content: ScriptContent };
      setContent(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <div>
        <Label htmlFor="topic">Topic</Label>
        <Input
          id="topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. AI productivity tools"
          required
          maxLength={500}
        />
      </div>
      <div>
        <Label htmlFor="audience">Audience</Label>
        <Input
          id="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g. solo founders & marketers"
          required
          maxLength={300}
        />
      </div>
      <div>
        <Label htmlFor="duration">Duration (seconds)</Label>
        <Input
          id="duration"
          type="number"
          value={durationSec}
          onChange={(e) => setDurationSec(Number(e.target.value))}
          min={10}
          max={300}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {content && (
        <div className="rounded border p-4 space-y-3 bg-muted/40">
          <p><span className="font-medium">Hook:</span> {content.hook}</p>
          <p><span className="font-medium">Body:</span> {content.body}</p>
          <p><span className="font-medium">CTA:</span> {content.cta}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || !topic || !audience}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {content ? "Regenerate" : "Generate Script"}
        </Button>
        {content && (
          <Button type="button" onClick={() => onDone(content)}>
            Use This Script →
          </Button>
        )}
      </div>
    </form>
  );
}
