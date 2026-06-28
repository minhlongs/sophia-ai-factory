'use client';

import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { Card, CardContent } from '@/seed/components/ui/card';
import { Button } from '@/seed/components/ui/button';
import { Badge } from '@/seed/components/ui/badge';

interface AudioPlayerCardProps {
  audioUrl: string;
  text: string;
  voice: string;
  generatedAt: Date;
}

const MAX_TEXT_PREVIEW = 100;

export function AudioPlayerCard({ audioUrl, text, voice, generatedAt }: AudioPlayerCardProps) {
  const t = useTranslations('creativeStudio.audio');
  const preview =
    text.length > MAX_TEXT_PREVIEW ? `${text.slice(0, MAX_TEXT_PREVIEW)}…` : text;

  const timestamp = generatedAt.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  function handleDownload() {
    window.open(audioUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <Card className="w-full">
      <CardContent className="pt-4 flex flex-col gap-3">
        {/* Audio player */}
        { }
        <audio controls src={audioUrl} className="w-full h-10" />

        {/* Text preview */}
        <p className="text-sm text-muted-foreground leading-snug">{preview}</p>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {voice}
            </Badge>
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload} aria-label="Download audio">
            <Download className="w-4 h-4 mr-1" aria-hidden="true" />
            {t('download')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
