"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Avatar, Voice } from "@/lib/services/types";

interface AssetPickerProps {
  avatarId: string;
  voiceId: string;
  onAvatarChange: (id: string) => void;
  onVoiceChange: (id: string) => void;
}

export function AssetPicker({ avatarId, voiceId, onAvatarChange, onVoiceChange }: AssetPickerProps) {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [aRes, vRes] = await Promise.all([
          fetch("/api/heygen/avatars"),
          fetch("/api/heygen/voices"),
        ]);
        if (!aRes.ok || !vRes.ok) throw new Error("Failed to load assets");
        const aData = (await aRes.json()) as { avatars: Avatar[] };
        const vData = (await vRes.json()) as { voices: Voice[] };
        if (!active) return;
        setAvatars(aData.avatars ?? []);
        setVoices(vData.voices ?? []);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading avatars &amp; voices...</div>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium mb-3">Choose Avatar</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {avatars.map((a) => (
            <button
              type="button"
              key={a.avatar_id}
              onClick={() => onAvatarChange(a.avatar_id)}
              className={`rounded border-2 p-2 text-left transition ${avatarId === a.avatar_id ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground"}`}
            >
              {a.preview_image_url ? (
                <img
                  src={a.preview_image_url}
                  alt={a.name}
                  className="w-full aspect-square object-cover rounded mb-2"
                />
              ) : (
                <div className="w-full aspect-square bg-muted rounded mb-2" />
              )}
              <p className="text-sm font-medium truncate">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.gender}</p>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="font-medium mb-3">Choose Voice</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {voices.map((v) => (
            <button
              type="button"
              key={v.voice_id}
              onClick={() => onVoiceChange(v.voice_id)}
              className={`rounded border-2 p-3 text-left transition ${voiceId === v.voice_id ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground"}`}
            >
              <p className="text-sm font-medium">{v.name}</p>
              <p className="text-xs text-muted-foreground">{v.gender} · {v.language}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
