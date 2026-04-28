"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ScriptContent, ScriptDraft } from "./video-creator-wizard";

interface ScriptStepProps {
  draft: ScriptDraft;
  onDraftChange: (
    updater: ScriptDraft | ((prev: ScriptDraft) => ScriptDraft),
  ) => void;
  onDone: (content: ScriptContent) => void;
}

export function ScriptStep({ draft, onDraftChange, onDone }: ScriptStepProps) {
  const t = useTranslations("dashboard.videos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof ScriptDraft>(key: K, value: ScriptDraft[K]) => {
    onDraftChange((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: draft.topic,
          audience: draft.audience,
          durationSec: draft.durationSec,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Script generation failed (${res.status})`);
      }
      const data = (await res.json()) as { content: ScriptContent };
      update("content", data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const { topic, audience, durationSec, content } = draft;

  return (
    <form onSubmit={handleGenerate} className="space-y-4">
      <div>
        <Label htmlFor="topic">{t("script.topic")}</Label>
        <Input
          id="topic"
          value={topic}
          onChange={(e) => update("topic", e.target.value)}
          placeholder={t("script.placeholderTopic")}
          required
          maxLength={500}
        />
      </div>
      <div>
        <Label htmlFor="audience">{t("script.audience")}</Label>
        <Input
          id="audience"
          value={audience}
          onChange={(e) => update("audience", e.target.value)}
          placeholder={t("script.placeholderAudience")}
          required
          maxLength={300}
        />
      </div>
      <div>
        <Label htmlFor="duration">{t("script.duration")}</Label>
        <Input
          id="duration"
          type="number"
          value={durationSec}
          onChange={(e) => update("durationSec", Number(e.target.value))}
          min={10}
          max={300}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {content && (
        <div className="rounded border p-4 space-y-3 bg-muted/40">
          <p><span className="font-medium">{t("script.hook")}:</span> {content.hook}</p>
          <p><span className="font-medium">{t("script.body")}:</span> {content.body}</p>
          <p><span className="font-medium">{t("script.cta")}:</span> {content.cta}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={loading || !topic || !audience}
          className="min-h-[44px]"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {content ? t("script.regenerate") : t("script.generate")}
        </Button>
        {content && (
          <Button
            type="button"
            onClick={() => onDone(content)}
            className="min-h-[44px]"
          >
            {t("script.useScript")}
          </Button>
        )}
      </div>
    </form>
  );
}
