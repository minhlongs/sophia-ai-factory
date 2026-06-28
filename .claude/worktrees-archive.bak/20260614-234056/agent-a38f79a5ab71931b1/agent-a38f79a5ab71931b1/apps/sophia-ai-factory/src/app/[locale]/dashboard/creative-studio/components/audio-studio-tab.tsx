'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/seed/components/ui/button';
import { generateTtsAction } from '@/app/actions/tts-generate-action';
import { AudioTextInput } from './audio-text-input';
import { AudioVoiceSelector } from './audio-voice-selector';
import { AudioPlayerCard } from './audio-player-card';

interface AudioClip {
  id: string;
  audioUrl: string;
  text: string;
  voice: string;
  generatedAt: Date;
}

interface AudioStudioTabProps {
  tier: string;
}

export function AudioStudioTab({ tier }: AudioStudioTabProps) {
  void tier;
  const t = useTranslations('creativeStudio.audio');
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('adam');
  const [history, setHistory] = useState<AudioClip[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateTtsAction({ text, voiceId: voice });
      if (result.success) {
        const clip: AudioClip = {
          id: crypto.randomUUID(),
          audioUrl: result.audioUrl,
          text,
          voice,
          generatedAt: new Date(),
        };
        setHistory((prev) => [clip, ...prev]);
      } else {
        setError(result.error);
      }
    });
  }

  const canSubmit = text.trim().length > 0 && !isPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Form */}
      <div className="flex flex-col gap-4">
        <AudioTextInput value={text} onChange={setText} />
        <AudioVoiceSelector value={voice} onChange={setVoice} tier={tier} />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button onClick={handleGenerate} disabled={!canSubmit} className="w-full">
          {isPending ? t('generating') : t('generateAudio')}
        </Button>
      </div>

      {/* Right: History */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {history.length === 0 ? t('emptyState') : t('clipsGenerated', { count: history.length })}
        </h3>
        {history.map((clip) => (
          <AudioPlayerCard
            key={clip.id}
            audioUrl={clip.audioUrl}
            text={clip.text}
            voice={clip.voice}
            generatedAt={clip.generatedAt}
          />
        ))}
      </div>
    </div>
  );
}
