"use client";

import { useState } from "react";
import { Button } from "@/seed/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ScriptStep } from "./script-step";
import { AssetPicker } from "./asset-picker";
import { RenderStatus } from "./render-status";

export interface ScriptContent {
  hook: string;
  body: string;
  cta: string;
}

type Step = "script" | "assets" | "render";

export interface ScriptDraft {
  topic: string;
  audience: string;
  durationSec: number;
  content: ScriptContent | null;
}

const EMPTY_DRAFT: ScriptDraft = {
  topic: "",
  audience: "",
  durationSec: 30,
  content: null,
};

const STEPS: Step[] = ["script", "assets", "render"];

export function VideoCreatorWizard() {
  const t = useTranslations("dashboard.videos");
  const [step, setStep] = useState<Step>("script");
  const [draft, setDraft] = useState<ScriptDraft>(EMPTY_DRAFT);
  const [script, setScript] = useState<ScriptContent | null>(null);
  const [avatarId, setAvatarId] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScriptDone = (content: ScriptContent) => {
    setScript(content);
    setDraft((d) => ({ ...d, content }));
    setStep("assets");
  };

  const handleCreateVideo = async () => {
    if (!script || !avatarId || !voiceId) return;
    setSubmitting(true);
    setError(null);
    try {
      const fullScript = [script.hook, script.body, script.cta].filter(Boolean).join(" ");
      const res = await fetch("/api/heygen/create-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId, voiceId, script: fullScript }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        if (data.code === "MISSING_KEY") {
          throw new Error(t("errors.missing_heygen_key"));
        }
        throw new Error(data.error ?? `Render request failed (${res.status})`);
      }
      const data = (await res.json()) as { videoId: string };
      setVideoId(data.videoId);
      setStep("render");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.unknown"));
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabel = (s: Step): string => {
    if (s === "script") return t("steps.script");
    if (s === "assets") return t("steps.assets");
    return t("steps.render");
  };

  return (
    <div className="space-y-6">
      <ol className="flex gap-2 text-sm font-medium" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={step === s ? "step" : undefined}
            className={`px-3 py-1 rounded ${step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {i + 1}. {stepLabel(s)}
          </li>
        ))}
      </ol>

      {step === "script" && (
        <ScriptStep draft={draft} onDraftChange={setDraft} onDone={handleScriptDone} />
      )}

      {step === "assets" && script && (
        <div className="space-y-4">
          <AssetPicker
            avatarId={avatarId}
            voiceId={voiceId}
            onAvatarChange={setAvatarId}
            onVoiceChange={setVoiceId}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("script")}
              disabled={submitting}
              className="min-h-[44px]"
            >
              {t("actions.back")}
            </Button>
            <Button
              onClick={handleCreateVideo}
              disabled={!avatarId || !voiceId || submitting}
              className="min-h-[44px]"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />}
              {t("actions.create")}
            </Button>
          </div>
        </div>
      )}

      {step === "render" && videoId && <RenderStatus videoId={videoId} />}
    </div>
  );
}
