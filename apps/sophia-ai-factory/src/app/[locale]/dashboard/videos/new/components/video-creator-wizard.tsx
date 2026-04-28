"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ScriptStep } from "./script-step";
import { AssetPicker } from "./asset-picker";
import { RenderStatus } from "./render-status";

export interface ScriptContent {
  hook: string;
  body: string;
  cta: string;
}

type Step = "script" | "assets" | "render";

export function VideoCreatorWizard() {
  const [step, setStep] = useState<Step>("script");
  const [script, setScript] = useState<ScriptContent | null>(null);
  const [avatarId, setAvatarId] = useState<string>("");
  const [voiceId, setVoiceId] = useState<string>("");
  const [videoId, setVideoId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScriptDone = (content: ScriptContent) => {
    setScript(content);
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
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Render request failed (${res.status})`);
      }
      const data = (await res.json()) as { videoId: string };
      setVideoId(data.videoId);
      setStep("render");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ol className="flex gap-2 text-sm font-medium" aria-label="Progress">
        {(["script", "assets", "render"] as Step[]).map((s, i) => (
          <li
            key={s}
            className={`px-3 py-1 rounded ${step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
          </li>
        ))}
      </ol>

      {step === "script" && <ScriptStep onDone={handleScriptDone} />}

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
            <Button variant="outline" onClick={() => setStep("script")}>Back</Button>
            <Button
              onClick={handleCreateVideo}
              disabled={!avatarId || !voiceId || submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Video
            </Button>
          </div>
        </div>
      )}

      {step === "render" && videoId && <RenderStatus videoId={videoId} />}
    </div>
  );
}
